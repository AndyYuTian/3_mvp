// StoryData.ts
// 剧情对话的数据结构定义

// 每一段对话的基本单元
export interface DialogLine {
    // 发言角色 ID：0-3 是男主，-1 是女主自己，-2 是旁白/心声
    speaker: number;
    // 角色的表情：normal/happy/sad/angry/shy/thinking
    emotion?: string;
    // 对话文本
    text: string;
    // 背景图（只在全屏模式生效），不填则继承上一句
    bg?: string;
    // 是否全屏展示此句（可以中途切换展示模式）
    fullscreen?: boolean;
}

// 玩家选择支
export interface DialogChoice {
    // 选项文本
    text: string;
    // 选后跳转到哪一个 lineIndex（对应 lines 数组的下标）
    jumpTo: number;
    // 选后对关联男主的好感度影响
    affinityDelta?: number;
}

// 选择点：在某一行对话后出现
export interface ChoicePoint {
    // 出现在第几行之后（对应 lines 数组下标）
    afterLine: number;
    // 提问文本（可选）
    prompt?: string;
    // 2-3 个选项
    choices: DialogChoice[];
}

// 一段完整剧情
export interface StoryScript {
    // 剧情 ID（对应 LevelConfig.storyTrigger）
    id: number;
    // 剧情名称（调试用）
    name: string;
    // 关联男主（用于显示角色头像和增减好感度）
    charId: number;
    // 默认展示模式
    defaultMode: "fullscreen" | "bubble";
    // 对话序列
    lines: DialogLine[];
    // 选择点（可选）
    choices?: ChoicePoint[];
}

// 角色显示名映射
export const SPEAKER_NAMES: Record<number, string> = {
    [-2]: "",                // 旁白
    [-1]: "苏晴",            // 女主
    [0]:  "叶司宸",
    [1]:  "林知远",
    [2]:  "顾铭川",
    [3]:  "方宁朔",
};

// 角色主色调（用于对话框配色）
export const SPEAKER_COLORS: Record<number, string> = {
    [-2]: "#888888",
    [-1]: "#D4537E",
    [0]:  "#993C1D",   // 叶司宸 - coral
    [1]:  "#185FA5",   // 林知远 - blue
    [2]:  "#3C3489",   // 顾铭川 - purple
    [3]:  "#0F6E56",   // 方宁朔 - teal
};
