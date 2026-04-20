// StoryPanel.ts
// 全屏剧情面板（Galgame 风格）
// 挂到场景中的 StoryPanel 节点上，需要子节点：BgImage、CharSprite、NameLabel、ContentLabel、ChoiceContainer 等

import {
    _decorator, Component, Node, Label, Button, Sprite, Color,
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
    bgNode: Node = null!;      // 背景节点（Sprite 或 Graphics）

    @property(Label)
    nameLabel: Label = null!;  // 角色名

    @property(Label)
    contentLabel: Label = null!;  // 对话文本

    @property(Node)
    dialogBox: Node = null!;   // 底部对话框（带颜色条）

    @property(Node)
    charNameBadge: Node = null!;  // 角色名的彩色背景条

    @property(Node)
    continueHint: Node = null!;   // 点击继续提示（▼）

    @property(Node)
    choiceContainer: Node = null!;  // 选择支容器

    @property(Prefab)
    choiceButtonPrefab: Prefab = null!;   // 单个选项的 prefab（Button + Label）

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
        // 点击整个面板推进对话
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

        // 更新角色名和颜色
        const name = SPEAKER_NAMES[line.speaker] ?? "???";
        const color = SPEAKER_COLORS[line.speaker] ?? "#888888";

        if (line.speaker === -2) {
            // 旁白：隐藏角色名条
            this.charNameBadge.active = false;
            this.nameLabel.string = "";
        } else {
            this.charNameBadge.active = true;
            this.nameLabel.string = name;
            // 给角色名条染色
            this.tintNode(this.charNameBadge, color);
        }

        // 打字机效果
        this.fullText = line.text;
        this.typedChars = 0;
        this.isTypewriting = true;
        this.contentLabel.string = "";
        this.continueHint.active = false;
        this.typewriterTimer = 0;

        // 背景切换（如果指定了新背景）
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
            // 打字中点击：直接显示完整文本
            this.typedChars = this.fullText.length;
            this.contentLabel.string = this.fullText;
            this.isTypewriting = false;
            this.continueHint.active = true;
            this.tryShowChoices();
        } else {
            // 已显示完：前进到下一句
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

        cp.choices.forEach((choice, idx) => {
            const btn = instantiate(this.choiceButtonPrefab);
            this.choiceContainer.addChild(btn);

            // 找到按钮里的 Label，设置文本
            const label = btn.getComponentInChildren(Label);
            if (label) label.string = choice.text;

            // 垂直排列
            btn.setPosition(0, -idx * 80, 0);

            // 点击事件
            const button = btn.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, () => {
                    this.onChoiceSelect(choice);
                }, this);
            }
        });
    }

    private onChoiceSelect(choice: DialogChoice) {
        // 累加好感度变化
        if (choice.affinityDelta) {
            this.affinityDelta += choice.affinityDelta;
        }

        // 隐藏选项
        this.choiceContainer.active = false;
        this.waitingChoice = false;

        // 跳转到指定行
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

    // 给一个节点的 Graphics 或 Sprite 染色
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
            return;
        }
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            const color = new Color();
            Color.fromHEX(color, hex);
            sprite.color = color;
        }
    }

    // 根据名称设置背景（MVP 阶段用纯色，后期替换为图片）
    private setBackground(bgName: string) {
        if (!this.bgNode) return;
        // 简单实现：根据 bg 名称切换颜色
        const bgColors: Record<string, string> = {
            "rehearsal":  "#2C2C2A",  // 排练室 - 深灰
            "rooftop":    "#3C3489",  // 天台 - 紫
            "rainy":      "#185FA5",  // 雨夜 - 深蓝
            "stage":      "#993C1D",  // 舞台 - 暗红
            "street":     "#5F5E5A",  // 街头 - 中灰
            "default":    "#444441",
        };
        const hex = bgColors[bgName] ?? bgColors["default"];
        this.tintNode(this.bgNode, hex);
    }
}
