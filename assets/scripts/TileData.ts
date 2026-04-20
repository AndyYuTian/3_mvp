// TileData.ts
// 方块类型枚举 - 对应「暗声共鸣」的音乐主题方块

export enum TileType {
    None     = 0,
    Guitar   = 1,  // 吉他拨片（红）
    Drum     = 2,  // 鼓棒（蓝）
    Vinyl    = 3,  // 黑胶唱片（紫）
    Mic      = 4,  // 麦克风（绿）
    Note     = 5,  // 音符（橙）
}

export const TILE_COUNT = 5; // 方块种类数（不含 None）

// 每种方块对应的颜色，用于占位矩形阶段
export const TILE_COLORS: Record<TileType, string> = {
    [TileType.None]:   "#00000000",
    [TileType.Guitar]: "#E24B4A",
    [TileType.Drum]:   "#378ADD",
    [TileType.Vinyl]:  "#7F77DD",
    [TileType.Mic]:    "#1D9E75",
    [TileType.Note]:   "#BA7517",
};

export interface TileCell {
    type: TileType;
    row:  number;
    col:  number;
}

// 方块显示名称（用于 UI）
export const TILE_NAMES: Record<TileType, string> = {
    [TileType.None]:   "",
    [TileType.Guitar]: "吉他拨片",
    [TileType.Drum]:   "鼓棒",
    [TileType.Vinyl]:  "黑胶",
    [TileType.Mic]:    "麦克风",
    [TileType.Note]:   "音符",
};