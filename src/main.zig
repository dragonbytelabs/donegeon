const std = @import("std");
const donegeon = @import("donegeon");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var store = donegeon.init(allocator);
    defer donegeon.deinit(&store);

    _ = try store.addTask("hi mom from main", null);
    try store.save("tasks.json");
}
