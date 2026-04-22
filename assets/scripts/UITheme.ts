// UITheme.ts
// 全局 UI 主题系统
// 所有颜色、字号、圆角、间距都从这里取，保证全游戏一致
// 想换整体风格？只改这里就行

import { Color } from "cc";

export const UITheme = {

    // ─── 主色系 ────────────────────────────────────────────
    // 采用柔和甜色，符合「轻松明快」调性

    color: {
        // 背景色（从浅到深）
        bgMain:      "#FFF9F5",  // 主背景 - 奶白粉
        bgCard:      "#FFFFFF",  // 卡片白
        bgOverlay:   "#00000088", // 半透明遮罩（深色）

        // 品牌主色
        primary:     "#FF7BA8",  // 主粉 - 按钮/强调
        primaryDark: "#E85B8C",  // 主粉深（按下态）
        primaryLight:"#FFD5E3",  // 主粉浅（hover）

        // 辅助色
        accent:      "#8DD4E8",  // 天青 - 次要按钮
        gold:        "#FFC947",  // 金 - 星星、奖励
        warning:     "#FF8B6B",  // 橙 - 警告
        danger:      "#FF5858",  // 红 - 危险/失败

        // 文字色（从深到浅）
        textMain:    "#3D2E3F",  // 主文字 - 深紫褐（比黑柔和）
        textSub:     "#7A6B7D",  // 次文字
        textHint:    "#BDB0BF",  // 提示文字
        textOnColor: "#FFFFFF",  // 色块上的白字

        // 四位男主的品牌色（用于区分）
        yeRed:       "#E85B5B",  // 叶司宸 - 红
        linBlue:     "#4A90E2",  // 林知远 - 蓝
        guPurple:    "#9B7FE8",  // 顾铭川 - 紫
        fangGreen:   "#4FC4A0",  // 方宁朔 - 绿
    },

    // ─── 字号规范 ──────────────────────────────────────────

    fontSize: {
        h1: 40,  // 大标题（通关！）
        h2: 32,  // 二级标题（关卡名）
        h3: 24,  // 三级标题（对话角色名）
        body: 22,  // 正文
        label: 18,  // 标签/次要文字
        hint: 16,  // 提示文字
    },

    // ─── 圆角规范 ──────────────────────────────────────────

    radius: {
        small: 8,   // 小元素（标签、小按钮）
        medium: 16, // 卡片、弹窗内元素
        large: 24,  // 主要按钮、大卡片
        pill: 999,  // 胶囊形（药丸按钮）
    },

    // ─── 间距规范 ──────────────────────────────────────────

    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },

    // ─── 阴影（Cocos 不支持 box-shadow，用来做强调边框）──

    shadow: {
        soft:   "#00000011",
        medium: "#00000022",
        strong: "#00000044",
    },

    // ─── 动画时长 ──────────────────────────────────────────

    duration: {
        fast: 0.15,
        normal: 0.3,
        slow: 0.5,
    },

    // ─── 工具函数 ──────────────────────────────────────────

    hex(hexStr: string): Color {
        const c = new Color();
        Color.fromHEX(c, hexStr);
        return c;
    },

    // 获取角色主色
    charColor(charId: number): string {
        const map: Record<number, string> = {
            0: this.color.yeRed,
            1: this.color.linBlue,
            2: this.color.guPurple,
            3: this.color.fangGreen,
        };
        return map[charId] ?? this.color.primary;
    },
};
