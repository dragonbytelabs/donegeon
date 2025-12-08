const std = @import("std");
const donegeon = @import("root.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var store = donegeon.init(allocator);
    defer donegeon.deinit(&store);

    _ = try store.addTask("hi mom from main", null);
    try store.save("tasks.json");
}

test "donegeon main test" {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var store = donegeon.init(allocator);
    defer donegeon.deinit(&store);

    _ = try store.addTask("test task from donegeon.zig", null);
    try store.save("tasks_from_donegeon.json");

    try std.testing.expect(store.next_id == 2);
    try std.testing.expectEqualStrings("test task from donegeon.zig", store.tasks.get(1).?.name);
    try std.testing.expect(store.tasks.count() == 1);
}
