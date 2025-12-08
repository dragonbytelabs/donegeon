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
