const std = @import("std");
const TaskStore = @import("store.zig").TaskStore;

pub fn init(alloc: std.mem.Allocator) TaskStore {
    return TaskStore.init(alloc);
}

pub fn deinit(store: *TaskStore) void {
    store.deinit();
}
