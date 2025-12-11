const std = @import("std");
const Task = @import("task.zig").Task;

pub const TagPatch = union(enum) {
    add: []const u8,
    remove: []const u8,
    replace: []const []const u8,
    clear,
};

fn addTagToTask(alloc: std.mem.Allocator, task: Task, tag: []const u8) !Task {
    // check if exists
    for (task.tags) |t| {
        if (std.mem.eql(u8, t, tag)) return task; // no-op
    }

    const new_len = task.tags.len + 1;
    const new_tags = try alloc.alloc([]const u8, new_len);

    @memcpy(new_tags[0..task.tags.len], task.tags);
    new_tags[new_len - 1] = tag;

    return Task{
        .id = task.id,
        .name = task.name,
        .description = task.description,
        .due = task.due,
        .tags = new_tags,
    };
}

fn removeTagFromTask(alloc: std.mem.Allocator, task: Task, tag: []const u8) !Task {
    var count: usize = 0;
    for (task.tags) |t| {
        if (!std.mem.eql(u8, t, tag)) count += 1;
    }

    const new_tags = try alloc.alloc([]const u8, count);
    var idx: usize = 0;

    for (task.tags) |t| {
        if (!std.mem.eql(u8, t, tag)) {
            new_tags[idx] = t;
            idx += 1;
        }
    }

    return Task{
        .id = task.id,
        .name = task.name,
        .description = task.description,
        .due = task.due,
        .tags = new_tags,
    };
}

test "addTagToTask adds a new tag to default 'inbox'" {
    var alloc = std.testing.allocator;

    // Task.init with null tags uses ["home"] as default
    const task = Task.init(1, "Test", null, null);
    try std.testing.expectEqual(@as(usize, 1), task.tags.len);
    try std.testing.expect(std.mem.eql(u8, task.tags[0], "inbox"));

    const updated = try addTagToTask(alloc, task, "work");
    defer alloc.free(updated.tags);

    try std.testing.expectEqual(@as(usize, 2), updated.tags.len);
    try std.testing.expect(std.mem.eql(u8, updated.tags[0], "inbox"));
    try std.testing.expect(std.mem.eql(u8, updated.tags[1], "work"));
}

test "addTagToTask does not duplicate an existing tag" {
    const alloc = std.testing.allocator;

    const initial_tags = &[_][]const u8{ "inbox", "work" };
    const task = Task.init(2, "Task", null, initial_tags);

    const updated = try addTagToTask(alloc, task, "work");
    // In this case addTagToTask returns the original task (no new alloc),
    // so DO NOT free updated.tags here.
    try std.testing.expectEqual(@as(usize, 2), updated.tags.len);
    try std.testing.expect(std.mem.eql(u8, updated.tags[0], "inbox"));
    try std.testing.expect(std.mem.eql(u8, updated.tags[1], "work"));
}

test "removeTagFromTask removes an existing tag" {
    var alloc = std.testing.allocator;

    const initial_tags = &[_][]const u8{ "inbox", "work", "urgent" };
    const task = Task.init(3, "Task", null, initial_tags);

    const updated = try removeTagFromTask(alloc, task, "work");
    defer alloc.free(updated.tags);

    try std.testing.expectEqual(@as(usize, 2), updated.tags.len);
    try std.testing.expect(std.mem.eql(u8, updated.tags[0], "inbox"));
    try std.testing.expect(std.mem.eql(u8, updated.tags[1], "urgent"));
}

test "removeTagFromTask with non-existent tag keeps all tags" {
    var alloc = std.testing.allocator;

    const initial_tags = &[_][]const u8{ "inbox", "work" };
    const task = Task.init(4, "Task", null, initial_tags);

    const updated = try removeTagFromTask(alloc, task, "urgent");
    defer alloc.free(updated.tags);

    // Your current implementation allocates a new slice even if nothing is removed
    try std.testing.expectEqual(@as(usize, 2), updated.tags.len);
    try std.testing.expect(std.mem.eql(u8, updated.tags[0], "inbox"));
    try std.testing.expect(std.mem.eql(u8, updated.tags[1], "work"));
}
