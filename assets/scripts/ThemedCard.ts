// ThemedCard.ts
// 统一卡片样式（白底 + 圆角，用于弹窗、面板、对话框）

import { _decorator, Component, Graphics, UITransform, Color } from "cc";
import { UITheme } from "./UITheme";

const { ccclass, property } = _decorator;

export enum CardStyle {
    White,       // 白色卡片（主要弹窗）
    Tinted,      // 带色调的卡片（主题色淡化）
    Translucent, // 半透明（叠在游戏上）
}

@ccclass("ThemedCard")
export class ThemedCard extends Component {

    @property
    style: number = CardStyle.White;

    @property
    radius: number = 24;  // 圆角半径

    @property
    tintColor: string = "";  // Tinted 模式下的主题色，不填则用 primary

    @property
    hasBorder: boolean = false;

    start() { this.draw(); }
    onEnable() { this.draw(); }

    private draw() {
        const ui = this.getComponent(UITransform);
        const g = this.getComponent(Graphics) || this.addComponent(Graphics);
        if (!ui) return;

        const w = ui.contentSize.width;
        const h = ui.contentSize.height;

        g.clear();

        let bgHex: string;
        let borderHex: string = "";

        switch (this.style) {
            case CardStyle.White:
                bgHex = UITheme.color.bgCard;
                borderHex = UITheme.color.primaryLight;
                break;
            case CardStyle.Tinted:
                bgHex = this.tintColor || UITheme.color.primaryLight;
                borderHex = this.tintColor || UITheme.color.primary;
                break;
            case CardStyle.Translucent:
                bgHex = "#FFFFFFDD";
                break;
            default:
                bgHex = UITheme.color.bgCard;
        }

        g.fillColor = UITheme.hex(bgHex);
        g.roundRect(-w / 2, -h / 2, w, h, this.radius);
        g.fill();

        if (this.hasBorder && borderHex) {
            g.strokeColor = UITheme.hex(borderHex);
            g.lineWidth = 2;
            g.roundRect(-w / 2, -h / 2, w, h, this.radius);
            g.stroke();
        }
    }

    // 外部动态换色
    setStyle(style: CardStyle, tintColor?: string) {
        this.style = style;
        if (tintColor) this.tintColor = tintColor;
        this.draw();
    }
}
