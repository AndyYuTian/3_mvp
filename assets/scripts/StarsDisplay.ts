// StarsDisplay.ts
// 星星动态显示：逐个跳出，有放大弹性，三星有特效
// 挂到 StarsContainer 节点上，下面需要 3 个子 Label 节点（Star1, Star2, Star3）

import {
    _decorator, Component, Node, Label, tween, v3, Vec3, Color, UIOpacity
} from "cc";
import { UITheme } from "./UITheme";

const { ccclass, property } = _decorator;

@ccclass("StarsDisplay")
export class StarsDisplay extends Component {

    @property(Label)
    star1: Label = null!;

    @property(Label)
    star2: Label = null!;

    @property(Label)
    star3: Label = null!;

    private stars: Label[] = [];

    onLoad() {
        this.stars = [this.star1, this.star2, this.star3];
        // 初始隐藏
        this.stars.forEach(s => {
            if (!s) return;
            s.string = "☆";
            const op = s.node.getComponent(UIOpacity) || s.node.addComponent(UIOpacity);
            op.opacity = 0;
            s.node.scale = v3(0, 0, 1);
        });
    }

    // 外部调用：展示星级（1/2/3 星）
    show(earnedStars: number) {
        // 全部先重置
        this.stars.forEach(s => {
            if (!s) return;
            s.string = "☆";
            s.color = UITheme.hex(UITheme.color.textHint);
            const op = s.node.getComponent(UIOpacity) || s.node.addComponent(UIOpacity);
            op.opacity = 0;
            s.node.scale = v3(0, 0, 1);
        });

        // 逐个出现（所有三个都出现，但只前 earnedStars 个是亮的）
        this.stars.forEach((star, i) => {
            if (!star) return;

            const delay = 0.2 + i * 0.25;  // 每颗错开 0.25 秒
            const isEarned = i < earnedStars;
            const isLast = (i === earnedStars - 1) && earnedStars === 3;

            this.animateStarIn(star, delay, isEarned, isLast);
        });
    }

    private animateStarIn(star: Label, delay: number, earned: boolean, isFinal: boolean) {
        const opacity = star.node.getComponent(UIOpacity)!;

        // 淡入
        tween(opacity)
            .delay(delay)
            .to(0.15, { opacity: 255 })
            .start();

        // 从 0 弹跳放大到 1.2 再回落到 1.0（弹性感）
        tween(star.node)
            .delay(delay)
            .to(0.2, { scale: v3(1.4, 1.4, 1) }, { easing: "backOut" })
            .to(0.15, { scale: v3(1.0, 1.0, 1) }, { easing: "quadOut" })
            .call(() => {
                // 出现时把星星填色
                if (earned) {
                    star.string = "★";
                    star.color = UITheme.hex(UITheme.color.gold);

                    // 三星的最后一颗：额外来一波放大 + 缩回，强调庆祝感
                    if (isFinal) {
                        this.playFinaleEffect(star);
                    }
                }
            })
            .start();
    }

    // 第三颗星的爆发效果：大放大 + 脉冲
    private playFinaleEffect(star: Label) {
        // 第三颗星大爆发
        tween(star.node)
            .delay(0.1)
            .to(0.25, { scale: v3(1.6, 1.6, 1) }, { easing: "backOut" })
            .to(0.2, { scale: v3(1.0, 1.0, 1) }, { easing: "bounceOut" })
            .start();

        // 其他两颗星也跟着脉动一下（庆祝感）
        this.stars.forEach((s, idx) => {
            if (idx === 2 || !s) return;  // 跳过第三颗
            tween(s.node)
                .delay(0.1)
                .to(0.2, { scale: v3(1.2, 1.2, 1) }, { easing: "quadOut" })
                .to(0.2, { scale: v3(1.0, 1.0, 1) }, { easing: "quadIn" })
                .start();
        });
    }
}
