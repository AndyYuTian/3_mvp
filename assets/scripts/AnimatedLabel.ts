// AnimatedLabel.ts
// 数字渐变动画：从当前值滚动到目标值
// 用于分数、好感度这种"涨分爽感"的展示

import { _decorator, Component, Label, tween } from "cc";
const { ccclass, property } = _decorator;

@ccclass("AnimatedLabel")
export class AnimatedLabel extends Component {

    @property(Label)
    label: Label = null!;

    @property
    prefix: string = "";  // 比如 "得分 "

    @property
    suffix: string = "";  // 比如 "/500"

    @property
    duration: number = 0.6;  // 动画时长

    private currentValue: number = 0;
    private tweenObj: any = null;

    onLoad() {
        if (!this.label) this.label = this.getComponent(Label)!;
    }

    // 立刻设置数字（不做动画）
    setValue(value: number) {
        this.currentValue = value;
        this.updateDisplay();
    }

    // 从当前值动画到目标值
    animateTo(value: number) {
        if (this.tweenObj) this.tweenObj.stop();

        const from = { v: this.currentValue };
        const to = { v: value };

        this.tweenObj = tween(from)
            .to(this.duration, to, {
                onUpdate: () => {
                    this.currentValue = from.v;
                    this.updateDisplay();
                },
                easing: "quadOut"
            })
            .call(() => {
                this.currentValue = value;
                this.updateDisplay();
            })
            .start();
    }

    private updateDisplay() {
        if (!this.label) return;
        const num = Math.floor(this.currentValue);
        this.label.string = `${this.prefix}${num}${this.suffix}`;
    }
}
