// PopupAnimation.ts
// 弹窗出现动画：缩放 + 淡入
// 挂到 ResultPanel、StoryPanel 等弹窗节点上

import { _decorator, Component, Node, UIOpacity, tween, v3, Vec3 } from "cc";
const { ccclass } = _decorator;

@ccclass("PopupAnimation")
export class PopupAnimation extends Component {

    private opacity: UIOpacity = null!;

    onLoad() {
        this.opacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
    }

    // 外部调用：弹窗出现
    playShow() {
        this.node.scale = v3(0.7, 0.7, 1);
        this.opacity.opacity = 0;

        tween(this.opacity)
            .to(0.25, { opacity: 255 }, { easing: "quadOut" })
            .start();

        tween(this.node)
            .to(0.35, { scale: v3(1, 1, 1) }, { easing: "backOut" })
            .start();
    }

    // 外部调用：弹窗消失（onComplete 动画结束时回调）
    playHide(onComplete?: () => void) {
        tween(this.opacity)
            .to(0.2, { opacity: 0 }, { easing: "quadIn" })
            .start();

        tween(this.node)
            .to(0.2, { scale: v3(0.85, 0.85, 1) }, { easing: "quadIn" })
            .call(() => onComplete?.())
            .start();
    }
}
