//! By convention, root.zig is the root source file when making a library.
const std = @import("std");

var taskCounter: i32 = 0;
var tasks: TaskHashMap = undefined;
var allocator: std.mem.Allocator = undefined;

pub fn init(alloc: std.mem.Allocator) void {
    allocator = alloc;
    tasks = TaskHashMap.init(allocator);
    taskCounter = 1;
}

pub fn deinit() void {
    tasks.deinit();
}

const Task = struct {
    id: i32,
    name: []const u8,
    tag: []const u8,
    description: ?[]const u8,
    due: ?i64,

    pub fn init(id: i32, name: []const u8, description: ?[]const u8, tag: ?[]const u8) Task {
        const defaultTag = tag orelse "home";
        return Task{ .id = id, .name = name, .description = description, .tag = defaultTag, .due = null };
    }
};

const TaskHashMap = struct {
    buckets: std.ArrayListUnmanaged(?Task),
    count: usize,
    alloc: std.mem.Allocator,

    const initial_capacity = 16;

    pub fn init(alloc: std.mem.Allocator) TaskHashMap {
        return TaskHashMap{
            .buckets = .{},
            .count = 0,
            .alloc = alloc,
        };
    }

    pub fn deinit(self: *TaskHashMap) void {
        self.buckets.deinit(self.alloc);
    }

    fn hash(id: i32) usize {
        return @as(usize, @intCast(id));
    }

    fn ensureCapacity(self: *TaskHashMap, new_count: usize) !void {
        const needed = new_count * 2;
        if (self.buckets.items.len >= needed) return;

        const new_capacity = @max(initial_capacity, needed);
        const old_buckets = self.buckets.items;

        try self.buckets.resize(self.alloc, new_capacity);
        @memset(self.buckets.items, null);

        for (old_buckets) |maybe_task| {
            if (maybe_task) |task| {
                try self.putInternal(task);
            }
        }
    }

    fn putInternal(self: *TaskHashMap, task: Task) !void {
        var index = hash(task.id) % self.buckets.items.len;
        while (self.buckets.items[index] != null) {
            if (self.buckets.items[index].?.id == task.id) {
                self.buckets.items[index] = task;
                return;
            }
            index = (index + 1) % self.buckets.items.len;
        }
        self.buckets.items[index] = task;
    }

    pub fn put(self: *TaskHashMap, task: Task) !void {
        try self.ensureCapacity(self.count + 1);
        try self.putInternal(task);
        self.count += 1;
    }

    pub fn get(self: *const TaskHashMap, id: i32) ?Task {
        if (self.buckets.items.len == 0) return null;
        var index = hash(id) % self.buckets.items.len;
        const start = index;
        while (self.buckets.items[index]) |task| {
            if (task.id == id) return task;
            index = (index + 1) % self.buckets.items.len;
            if (index == start) break;
        }
        return null;
    }

    pub fn toSlice(self: *const TaskHashMap, alloc: std.mem.Allocator) ![]Task {
        var list: std.ArrayListUnmanaged(Task) = .{};
        defer list.deinit(alloc);
        for (self.buckets.items) |maybe_task| {
            if (maybe_task) |task| {
                try list.append(alloc, task);
            }
        }
        return try list.toOwnedSlice(alloc);
    }
};

pub fn addTask(name: []const u8, description: ?[]const u8) !Task {
    const task = Task.init(taskCounter, name, description, null);
    try tasks.put(task);
    std.debug.print("Created task {d}\n", .{task.id});
    taskCounter += 1;
    try saveTasks();
    return task;
}

pub fn getTask(id: i32) ?Task {
    return tasks.get(id);
}

pub fn saveTasks() !void {
    const file = try std.fs.cwd().createFile("tasks.json", .{});
    defer file.close();

    const task_slice = try tasks.toSlice(allocator);
    defer allocator.free(task_slice);

    // New-style writer: give it a buffer
    var buf: [4096]u8 = undefined;
    var file_writer = file.writer(&buf);
    const writer = &file_writer.interface;
    defer writer.flush() catch {};

    try std.json.fmt(task_slice, .{ .whitespace = .indent_2 }).format(writer);
}

pub fn loadTasks() !void {
    const file = std.fs.cwd().openFile("tasks.json", .{}) catch |err| {
        if (err == error.FileNotFound) return;
        return err;
    };
    defer file.close();

    const file_size = try file.getEndPos();
    const buffer = try allocator.alloc(u8, file_size);
    defer allocator.free(buffer);

    _ = try file.readAll(buffer);

    const parsed = try std.json.parseFromSlice([]Task, allocator, buffer, .{});
    defer parsed.deinit();

    tasks.deinit();
    tasks = TaskHashMap.init(allocator);

    for (parsed.value) |task| {
        try tasks.put(task);
        if (task.id >= taskCounter) {
            taskCounter = task.id + 1;
        }
    }
}

test "create task with name" {
    init(std.testing.allocator);
    defer deinit();
    defer std.fs.cwd().deleteFile("tasks.json") catch {};

    const task = try addTask("hi mom", null);
    try std.testing.expectEqualStrings("hi mom", task.name);
}

test "get task by id" {
    init(std.testing.allocator);
    defer deinit();
    defer std.fs.cwd().deleteFile("tasks.json") catch {};

    _ = try addTask("Task 1", null);
    const task2 = try addTask("Task 2", "description");

    const found = getTask(task2.id);
    try std.testing.expect(found != null);
    try std.testing.expectEqualStrings("Task 2", found.?.name);
}
