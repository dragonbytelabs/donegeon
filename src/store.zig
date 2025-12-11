const std = @import("std");
const Task = @import("task.zig").Task;
const TaskPatch = @import("task.zig").TaskPatch;
const tag = @import("tag.zig");

pub const TaskStore = struct {
    tasks: std.AutoHashMap(i32, Task),
    next_id: i32,

    pub fn init(allocator: std.mem.Allocator) TaskStore {
        return .{
            .tasks = std.AutoHashMap(i32, Task).init(allocator),
            .next_id = 1,
        };
    }

    pub fn deinit(self: *TaskStore) void {
        self.tasks.deinit();
    }

    fn alloc(self: *TaskStore) std.mem.Allocator {
        return self.tasks.allocator; // available on AutoHashMap
    }

    fn dataFilePath(self: *TaskStore, path: []const u8) ![]const u8 {
        const allocator = self.alloc();
        const dir = try std.fs.getAppDataDir(allocator, "donegeon");
        defer allocator.free(dir);
        try std.fs.cwd().makePath(dir);

        return try std.fs.path.join(allocator, &.{ dir, path });
    }

    pub fn addTask(self: *TaskStore, name: []const u8, description: ?[]const u8) !Task {
        const task = Task.init(self.next_id, name, description, null);
        try self.tasks.put(task.id, task);
        self.next_id += 1;
        return task;
    }

    pub fn getTask(self: *TaskStore, id: i32) ?Task {
        return self.tasks.get(id);
    }

    pub fn modifyTask(self: *TaskStore, id: i32, patch: TaskPatch) !?Task {
        var task = self.tasks.getPtr(id) orelse
            return error.TaskNotFound;

        if (patch.name) |new_name| {
            task.name = new_name;
        }

        if (patch.description) |new_description| {
            task.description = new_description;
        }

        if (patch.due) |new_due| {
            task.due = new_due;
        }

        if (patch.tags) |tag_patch| {
            switch (tag_patch) {
                .add => |t| {
                    task = try tag.addTagToTask(self.alloc(), task, t);
                },
                .remove => |t| {
                    task = try tag.removeTagFromTask(self.alloc(), task, t);
                },
                .replace => |new_tags| {
                    task.tags = new_tags;
                },
                .clear => {
                    task.tags = &.{};
                },
            }
        }

        try self.tasks.put(id, task);
        return task;
    }

    pub fn toSlice(self: *TaskStore) ![]Task {
        const allocator = self.alloc();

        var list: std.ArrayListUnmanaged(Task) = .{};
        defer list.deinit(allocator);

        var it = self.tasks.iterator();
        while (it.next()) |entry| {
            try list.append(allocator, entry.value_ptr.*);
        }

        return try list.toOwnedSlice(allocator);
    }

    pub fn save(self: *TaskStore, path: []const u8) !void {
        const allocator = self.alloc();
        const file_path = try self.dataFilePath(path);
        defer allocator.free(file_path);
        std.debug.print("Saving tasks to {s}\n", .{file_path});

        const file = try std.fs.cwd().createFile(file_path, .{});
        defer file.close();

        const task_slice = try self.toSlice();
        defer allocator.free(task_slice);

        var buf: [4096]u8 = undefined;
        var fw = file.writer(&buf);

        const writer = &fw.interface;
        defer writer.flush() catch {};
        try std.json.fmt(task_slice, .{ .whitespace = .indent_2 }).format(writer);
    }

    pub fn load(self: *TaskStore, path: []const u8) !void {
        const allocator = self.alloc();

        const file = std.fs.cwd().openFile(path, .{}) catch |err| {
            if (err == error.FileNotFound) return;
            return err;
        };
        defer file.close();

        const size = try file.getEndPos();
        const buf = try allocator.alloc(u8, size);
        defer allocator.free(buf);

        _ = try file.read(buf);

        const parsed = try std.json.parseFromSlice([]Task, allocator, buf, .{});
        defer parsed.deinit();

        self.tasks.clearRetainingCapacity();

        for (parsed.value) |task| {
            try self.tasks.put(task.id, task);
            if (task.id >= self.next_id) self.next_id = task.id + 1;
        }
    }
};

test "create task with name" {
    var store = TaskStore.init(std.testing.allocator);
    defer store.deinit();
    defer std.fs.cwd().deleteFile("tasks.json") catch {};

    const task = try store.addTask("hi mom", null);
    try std.testing.expectEqualStrings("hi mom", task.name);
}

test "task counter increments" {
    var store = TaskStore.init(std.testing.allocator);
    defer store.deinit();
    defer std.fs.cwd().deleteFile("tasks.json") catch {};

    try std.testing.expectEqual(@as(i32, 1), store.next_id);
    _ = try store.addTask("hi mom", null);
    _ = try store.addTask("hi mom 2", null);
    _ = try store.addTask("hi mom 3", null);
    try std.testing.expectEqual(@as(i32, 4), store.next_id);
}

test "tasks are saved to disk" {
    var store = TaskStore.init(std.testing.allocator);
    defer store.deinit();

    const path = "tasks_test.json";
    const full_path = try store.dataFilePath(path);
    defer std.testing.allocator.free(full_path);
    defer std.fs.cwd().deleteFile(full_path) catch {};

    _ = std.fs.cwd().statFile(full_path) catch |err| {
        try std.testing.expectEqual(error.FileNotFound, err);
    };

    _ = try store.addTask("hi mom", null);
    _ = try store.addTask("hi mom 2", null);
    _ = try store.addTask("hi mom 3", null);

    try store.save(path);

    const stat = try std.fs.cwd().statFile(full_path);
    try std.testing.expect(stat.size > 0);
}

test "tasks are loaded from disk" {
    var store = TaskStore.init(std.testing.allocator);
    const path = "test_tasks.json";
    defer store.deinit();
    const full_path = try store.dataFilePath(path);
    defer std.testing.allocator.free(full_path);
    defer std.fs.cwd().deleteFile(full_path) catch {};

    _ = try store.addTask("hi mom", null);
    _ = try store.addTask("hi mom 2", null);
    _ = try store.addTask("hi mom 3", null);

    try store.save(path);

    var store2 = TaskStore.init(std.testing.allocator);
    defer store2.deinit();

    try store2.load(full_path);
    try std.testing.expectEqual(@as(usize, 3), store2.tasks.count());
}

test "modify task" {
    var store = TaskStore.init(std.testing.allocator);
    defer store.deinit();

    const task = try store.addTask("initial name", "initial description");
    try std.testing.expectEqualStrings("initial name", task.name);
    try std.testing.expectEqualStrings("initial description", task.description orelse "");

    const patch = TaskPatch{
        .name = "updated name",
        .description = "updated description",
        .tags = &[_][]const u8{ "work", "urgent" },
        .due = 1700000000,
    };

    const modified_task_opt = try store.modifyTask(task.id, patch);
    try std.testing.expect(modified_task_opt != null);
    const modified_task = modified_task_opt.?;

    try std.testing.expectEqualStrings("updated name", modified_task.name);
    try std.testing.expectEqualStrings("updated description", modified_task.description orelse "");
    try std.testing.expectEqual(@as(usize, 2), modified_task.tags.len);
    try std.testing.expectEqual(@as(i64, 1700000000), modified_task.due orelse -1);
}
