// ThemedButton.ts
// 主题化按钮：自动绘制样式 + 按下动效
// 使用：节点挂 Button + 这个脚本即可，不需要手动设置 Graphics

import {
    _decorator, Component, Node, Graphics, UITransform,
    Button, EventHandler, tween, v3, Vec3, Color, Label
} from "cc";
import { UITheme } from "./UITheme";

const { ccclass, property } = _decorator;

export enum ButtonStyle {
    Primary,   // 主要按钮（粉）
    Accent,    // 次要按钮（青）
    Outline,   // 描边按钮
    Danger,    // 警告按钮（红）
}

@ccclass("ThemedButton")
export class ThemedButton extends Component {

    @property({ type: [Label] })
    labelRef: Label = null!;

    @property
    style: number = ButtonStyle.Primary;  // 用数字因为 Cocos 属性面板显示枚举麻烦

    @property
    playClickSound: boolean = true;

    private graphics: Graphics = null!;
    private originalScale: Vec3 = null!;

    onLoad() {
        this.graphics = this.getComponent(Graphics) || this.addComponent(Graphics);
        this.originalScale = this.node.scale.clone();

        const button = this.getComponent(Button) || this.addComponent(Button);

        // 按下和弹起动效
        this.node.on(Node.EventType.TOUCH_START, this.onPress, this);
        this.node.on(Node.EventType.TOUCH_END, this.onRelease, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onRelease, this);
    }

    start() {
        this.draw();
    }

    onEnable() {
        this.draw();
    }

    private draw() {
        const ui = this.getComponent(UITransform);
        if (!ui || !this.graphics) return;

        const w = ui.contentSize.width;
        const h = ui.contentSize.height;
        const r = Math.min(UITheme.radius.large, h / 2);

        this.graphics.clear();

        let bg: string;
        let labelColor: string;
        let hasBorder = false;

        switch (this.style) {
            case ButtonStyle.Primary:
                bg = UITheme.color.primary;
                labelColor = UITheme.color.textOnColor;
                break;
            case ButtonStyle.Accent:
                bg = UITheme.color.accent;
                labelColor = UITheme.color.textOnColor;
                break;
            case ButtonStyle.Outline:
                bg = UITheme.color.bgCard;
                labelColor = UITheme.color.primary;
                hasBorder = true;
                break;
            case ButtonStyle.Danger:
                bg = UITheme.color.danger;
                labelColor = UITheme.color.textOnColor;
                break;
            default:
                bg = UITheme.color.primary;
                labelColor = UITheme.color.textOnColor;
        }

        this.graphics.fillColor = UITheme.hex(bg);
        this.graphics.roundRect(-w / 2, -h / 2, w, h, r);
        this.graphics.fill();

        if (hasBorder) {
            this.graphics.strokeColor = UITheme.hex(UITheme.color.primary);
            this.graphics.lineWidth = 2;
            this.graphics.roundRect(-w / 2, -h / 2, w, h, r);
            this.graphics.stroke();
        }

        // 同步 Label 颜色
        if (this.labelRef) {
            this.labelRef.color = UITheme.hex(labelColor);
        }
    }

    private onPress() {
        tween(this.node)
            .to(UITheme.duration.fast, { scale: v3(0.95, 0.95, 1) }, { easing: "quadOut" })
            .start();
    }

    private onRelease() {
        tween(this.node)
            .to(UITheme.duration.fast, { scale: this.originalScale }, { easing: "backOut" })
            .start();
    }

    // 外部调用：改变样式
    setStyle(style: ButtonStyle) {
        this.style = style;
        this.draw();
    }
}
