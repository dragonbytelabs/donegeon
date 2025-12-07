//! By convention, root.zig is the root source file when making a library.
const std = @import("std");

const Task = struct {
    name: []const u8,
    description: ?[]const u8,

    pub fn init(name: []const u8, description: ?[]const u8) Task {
        return Task{ .name = name, .description = description };
    }
};

pub fn createTask(name: []const u8, description: ?[]const u8) Task {
    const task = Task.init(name, description);
    return task;
}

test "create task with name" {
    const name = "hi mom";
    const task = createTask(name, null);
    try std.testing.expectEqualStrings("hi mom", task.name);
}

test "create task with optional description" {
    const name = "hi mom";
    const description = "this worked";
    const task = createTask(name, description);
    try std.testing.expectEqualStrings("hi mom", task.name);
    try std.testing.expectEqualStrings("this worked", task.description.?);
}

pub fn add(a: i32, b: i32) i32 {
    return a + b;
}

test "basic add functionality" {
    try std.testing.expect(add(3, 7) == 10);
}
