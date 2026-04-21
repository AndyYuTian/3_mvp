// StoryPanel.ts
// 全屏剧情面板（适配 720x1280 竖屏）

import {
    _decorator, Component, Node, Label, Button, Color,
    UITransform, Graphics, Vec3, tween, v3, instantiate, Prefab
} from "cc";
import {
    StoryScript, DialogLine, ChoicePoint, DialogChoice,
    SPEAKER_NAMES, SPEAKER_COLORS
} from "./StoryData";

const { ccclass, property } = _decorator;

@ccclass("StoryPanel")
export class StoryPanel extends Component {

    @property(Node)
    bgNode: Node = null!;

    @property(Label)
    nameLabel: Label = null!;

    @property(Label)
    contentLabel: Label = null!;

    @property(Node)
    dialogBox: Node = null!;

    @property(Node)
    charNameBadge: Node = null!;

    @property(Node)
    continueHint: Node = null!;

    @property(Node)
    choiceContainer: Node = null!;

    @property(Prefab)
    choiceButtonPrefab: Prefab = null!;

    private script: StoryScript | null = null;
    private currentLine = 0;
    private affinityDelta = 0;
    private onCompleteCallback: ((delta: number) => void) | null = null;
    private isTypewriting = false;
    private typewriterTimer = 0;
    private fullText = "";
    private typedChars = 0;
    private waitingChoice = false;

    onLoad() {
        this.node.active = false;
        this.node.on(Node.EventType.TOUCH_END, this.onClickAdvance, this);
    }

    play(script: StoryScript, onComplete: (affinityDelta: number) => void) {
        this.script = script;
        this.currentLine = 0;
        this.affinityDelta = 0;
        this.onCompleteCallback = onComplete;
        this.waitingChoice = false;
        this.node.active = true;
        this.choiceContainer.active = false;
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
        const color = SPEAKER_COLORS[line.speaker] ?? "#888888";

        if (line.speaker === -2) {
            this.charNameBadge.active = false;
            this.nameLabel.string = "";
        } else {
            this.charNameBadge.active = true;
            this.nameLabel.string = name;
            this.tintNode(this.charNameBadge, color);
        }

        this.fullText = line.text;
        this.typedChars = 0;
        this.isTypewriting = true;
        this.contentLabel.string = "";
        this.continueHint.active = false;
        this.typewriterTimer = 0;

        if (line.bg) {
            this.setBackground(line.bg);
        }
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
                this.tryShowChoices();
            }
        }
    }

    private onClickAdvance() {
        if (this.waitingChoice) return;

        if (this.isTypewriting) {
            this.typedChars = this.fullText.length;
            this.contentLabel.string = this.fullText;
            this.isTypewriting = false;
            this.continueHint.active = true;
            this.tryShowChoices();
        } else {
            this.currentLine++;
            this.showLine();
        }
    }

    private tryShowChoices() {
        if (!this.script?.choices) return;
        const cp = this.script.choices.find(c => c.afterLine === this.currentLine);
        if (!cp) return;

        this.waitingChoice = true;
        this.renderChoices(cp);
    }

    private renderChoices(cp: ChoicePoint) {
        this.choiceContainer.active = true;
        this.choiceContainer.removeAllChildren();

        // 竖屏：每个按钮 70px 高，间隔 20px
        const btnHeight = 70;
        const gap = 20;
        const totalHeight = cp.choices.length * btnHeight + (cp.choices.length - 1) * gap;
        const startY = totalHeight / 2 - btnHeight / 2;

        cp.choices.forEach((choice, idx) => {
            const btn = instantiate(this.choiceButtonPrefab);
            this.choiceContainer.addChild(btn);

            const label = btn.getComponentInChildren(Label);
            if (label) label.string = choice.text;

            // 垂直居中排列
            const y = startY - idx * (btnHeight + gap);
            btn.setPosition(0, y, 0);

            const button = btn.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, () => {
                    this.onChoiceSelect(choice);
                }, this);
            } else {
                // 没有 Button 组件就用节点点击事件兜底
                btn.on(Node.EventType.TOUCH_END, (event: any) => {
                    event.propagationStopped = true;
                    this.onChoiceSelect(choice);
                }, this);
            }
        });
    }

    private onChoiceSelect(choice: DialogChoice) {
        if (choice.affinityDelta) {
            this.affinityDelta += choice.affinityDelta;
        }
        this.choiceContainer.active = false;
        this.waitingChoice = false;
        this.currentLine = choice.jumpTo;
        this.showLine();
    }

    private finish() {
        this.node.active = false;
        const cb = this.onCompleteCallback;
        const delta = this.affinityDelta;
        this.onCompleteCallback = null;
        this.script = null;
        cb?.(delta);
    }

    private tintNode(node: Node, hex: string) {
        const g = node.getComponent(Graphics);
        if (g) {
            const ui = node.getComponent(UITransform);
            if (!ui) return;
            const color = new Color();
            Color.fromHEX(color, hex);
            g.clear();
            g.fillColor = color;
            g.roundRect(-ui.contentSize.width / 2, -ui.contentSize.height / 2,
                        ui.contentSize.width, ui.contentSize.height, 8);
            g.fill();
        }
    }

    private setBackground(bgName: string) {
        if (!this.bgNode) return;
        const bgColors: Record<string, string> = {
            "rehearsal":  "#2C2C2A",
            "rooftop":    "#3C3489",
            "rainy":      "#185FA5",
            "stage":      "#993C1D",
            "street":     "#5F5E5A",
            "default":    "#444441",
        };
        const hex = bgColors[bgName] ?? bgColors["default"];
        this.tintNode(this.bgNode, hex);
    }
}