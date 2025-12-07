//! By convention, root.zig is the root source file when making a library.
const std = @import("std");

const Task = struct {
    name: []const u8,

    pub fn init(name: []const u8) Task {
        return Task{ .name = name };
    }
};

pub fn createTask(name: []const u8) Task {
    const task = Task.init(name);
    return task;
}

test "create task" {
    const name = "hi mom";
    const task = createTask(name);
    try std.testing.expectEqualStrings("hi mom", task.name);
}

pub fn add(a: i32, b: i32) i32 {
    return a + b;
}

test "basic add functionality" {
    try std.testing.expect(add(3, 7) == 10);
}
