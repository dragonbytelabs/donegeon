const std = @import("std");

pub const Task = struct {
    id: i32,
    name: []const u8,
    tag: []const u8,
    description: ?[]const u8,
    due: ?i64,

    pub fn init(id: i32, name: []const u8, description: ?[]const u8, tag: ?[]const u8) Task {
        const default_tag = tag orelse "home";
        return .{
            .id = id,
            .name = name,
            .description = description,
            .tag = default_tag,
            .due = null,
        };
    }
};

test "Task init" {
    const task = Task.init(1, "Test Task", null, null);
    try std.testing.expect(task.id == 1);
    try std.testing.expect(std.mem.eql(u8, task.name, "Test Task"));
    try std.testing.expect(std.mem.eql(u8, task.tag, "home"));
    try std.testing.expect(task.description == null);
    try std.testing.expect(task.due == null);
}
