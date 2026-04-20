// BgPainter.ts
// 用 Graphics 画一个纯色矩形背景（不需要图片资源）
// 挂到需要背景的节点上，设置颜色和透明度即可

import { _decorator, Component, Graphics, UITransform, Color } from "cc";
const { ccclass, property } = _decorator;

@ccclass("BgPainter")
export class BgPainter extends Component {

    @property({ tooltip: "背景色 hex，如 #000000" })
    colorHex: string = "#000000";

    @property({ tooltip: "透明度 0-255", range: [0, 255, 1] })
    alpha: number = 150;

    @property({ tooltip: "圆角半径，0 为直角" })
    cornerRadius: number = 0;

    start() {
        this.redraw();
    }

    onEnable() {
        // 节点激活时重绘
        this.redraw();
    }

    redraw() {
        const g = this.getComponent(Graphics) || this.addComponent(Graphics);
        const ui = this.getComponent(UITransform);
        if (!ui) {
            console.warn("[BgPainter] 节点缺少 UITransform");
            return;
        }

        const w = ui.contentSize.width;
        const h = ui.contentSize.height;

        g.clear();

        const color = new Color();
        Color.fromHEX(color, this.colorHex);
        color.a = this.alpha;

        g.fillColor = color;

        if (this.cornerRadius > 0) {
            g.roundRect(-w / 2, -h / 2, w, h, this.cornerRadius);
        } else {
            g.rect(-w / 2, -h / 2, w, h);
        }
        g.fill();
    }
}
