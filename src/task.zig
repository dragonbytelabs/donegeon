const std = @import("std");
const TagPatch = @import("tag.zig").TagPatch;

pub const Task = struct {
    id: i32,
    name: []const u8,
    tags: []const []const u8,
    description: ?[]const u8,
    due: ?i64,

    pub fn init(id: i32, name: []const u8, description: ?[]const u8, tags: ?[]const []const u8) Task {
        const default_tag = &[_][]const u8{"inbox"};
        return .{
            .id = id,
            .name = name,
            .description = description,
            .tags = tags orelse default_tag,
            .due = null,
        };
    }
};

pub const TaskPatch = struct {
    name: ?[]const u8 = null,
    description: ?[]const u8 = null,
    due: ?i64 = null,
    tags: ?TagPatch = null,
};

test "Task init with default tag" {
    const task = Task.init(1, "Test Task", null, null);
    try std.testing.expect(task.id == 1);
    try std.testing.expect(std.mem.eql(u8, task.name, "Test Task"));
    try std.testing.expect(std.mem.eql(u8, task.tags[0], "inbox"));
    try std.testing.expect(task.description == null);
    try std.testing.expect(task.due == null);
}

test "Task init with multiple tags" {
    const custom_tags = &[_][]const u8{ "work", "urgent", "meeting" };
    const task = Task.init(2, "Important Meeting", "Discuss Q4 goals", custom_tags);
    try std.testing.expect(task.tags.len == 3);
    try std.testing.expect(std.mem.eql(u8, task.tags[0], "work"));
    try std.testing.expect(std.mem.eql(u8, task.tags[1], "urgent"));
    try std.testing.expect(std.mem.eql(u8, task.tags[2], "meeting"));
}
