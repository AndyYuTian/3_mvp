// DialogBubble.ts
// 关卡内的小型对话弹窗
// 不占满屏幕，叠在游戏上面展示简短对话

import { _decorator, Component, Node, Label, Button, tween, v3, UIOpacity } from "cc";
import { StoryScript, DialogLine, SPEAKER_NAMES, SPEAKER_COLORS } from "./StoryData";

const { ccclass, property } = _decorator;

@ccclass("DialogBubble")
export class DialogBubble extends Component {

    @property(Label)
    nameLabel: Label = null!;

    @property(Label)
    contentLabel: Label = null!;

    @property(Node)
    continueHint: Node = null!;

    private script: StoryScript | null = null;
    private currentLine = 0;
    private onCompleteCallback: ((delta: number) => void) | null = null;
    private affinityDelta = 0;
    private isTypewriting = false;
    private fullText = "";
    private typedChars = 0;
    private typewriterTimer = 0;

    onLoad() {
        this.node.active = false;
        this.node.on(Node.EventType.TOUCH_END, this.onClick, this);
    }

    play(script: StoryScript, onComplete: (affinityDelta: number) => void) {
        this.script = script;
        this.currentLine = 0;
        this.affinityDelta = 0;
        this.onCompleteCallback = onComplete;

        this.node.active = true;

        // 从下方滑入动画
        const startPos = v3(this.node.position.x, this.node.position.y - 100, 0);
        const targetPos = v3(this.node.position.x, this.node.position.y, 0);
        this.node.setPosition(startPos);

        let opacity = this.node.getComponent(UIOpacity);
        if (!opacity) opacity = this.node.addComponent(UIOpacity);
        opacity.opacity = 0;

        tween(this.node)
            .to(0.3, { position: targetPos }, { easing: "quadOut" })
            .start();
        tween(opacity)
            .to(0.3, { opacity: 255 })
            .start();

        this.showLine();
    }

    private showLine() {
        if (!this.script) return;
        if (this.currentLine >= this.script.lines.length) {
            this.finish();
            return;
        }

        const line = this.script.lines[this.currentLine];
        const name = SPEAKER_NAMES[line.speaker] ?? "???";

        this.nameLabel.string = name;

        this.fullText = line.text;
        this.typedChars = 0;
        this.isTypewriting = true;
        this.contentLabel.string = "";
        this.continueHint.active = false;
        this.typewriterTimer = 0;
    }

    update(dt: number) {
        if (!this.isTypewriting) return;

        this.typewriterTimer += dt;
        const charsPerSecond = 30;
        const shouldShow = Math.floor(this.typewriterTimer * charsPerSecond);

        if (shouldShow > this.typedChars && this.typedChars < this.fullText.length) {
            this.typedChars = Math.min(shouldShow, this.fullText.length);
            this.contentLabel.string = this.fullText.substring(0, this.typedChars);

            if (this.typedChars >= this.fullText.length) {
                this.isTypewriting = false;
                this.continueHint.active = true;
            }
        }
    }

    private onClick() {
        if (this.isTypewriting) {
            this.typedChars = this.fullText.length;
            this.contentLabel.string = this.fullText;
            this.isTypewriting = false;
            this.continueHint.active = true;
        } else {
            this.currentLine++;
            this.showLine();
        }
    }

    private finish() {
        let opacity = this.node.getComponent(UIOpacity);
        if (!opacity) opacity = this.node.addComponent(UIOpacity);

        tween(opacity)
            .to(0.2, { opacity: 0 })
            .call(() => {
                this.node.active = false;
                const cb = this.onCompleteCallback;
                const delta = this.affinityDelta;
                this.onCompleteCallback = null;
                this.script = null;
                cb?.(delta);
            })
            .start();
    }
}
