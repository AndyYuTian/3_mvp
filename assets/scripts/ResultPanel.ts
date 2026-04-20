// ResultPanel.ts
// 关卡结算弹窗 - 显示本关好感度变化

import { _decorator, Component, Node, Label, Button } from "cc";
import { GameManager } from "./GameManager";
import { LevelConfig, LevelResult } from "./GameManager";

const { ccclass, property } = _decorator;

// 角色名字映射
const CHAR_NAMES = ["叶司宸", "林知远", "顾铭川", "方宁朔"];

@ccclass("ResultPanel")
export class ResultPanel extends Component {

    @property(GameManager)
    gameManager!: GameManager;

    @property(Label)
    titleLabel!: Label;

    @property(Label)
    scoreLabel!: Label;

    @property(Label)
    starsLabel!: Label;

    @property(Label)
    affinityLabel: Label = null!;

    @property(Node)
    nextButton!: Node;

    @property(Node)
    retryButton!: Node;

    onLoad() {
        this.node.active = false;
        this.nextButton?.on(Button.EventType.CLICK, this.onClickNext, this);
        this.retryButton?.on(Button.EventType.CLICK, this.onClickRetry, this);
    }

    show(result: LevelResult, config: LevelConfig, score: number, steps: number) {
        this.node.active = true;

        if (result === "win") {
            this.titleLabel.string = "通关！";
            this.nextButton.active = true;
            this.retryButton.active = false;

            const stars = this.calcStars(steps, config.maxSteps);
            this.starsLabel.string = "★".repeat(stars) + "☆".repeat(3 - stars);

            this.showAffinity(config, true);
        } else {
            this.titleLabel.string = "挑战失败";
            this.nextButton.active = false;
            this.retryButton.active = true;
            this.starsLabel.string = "☆☆☆";

            this.showAffinity(config, false);
        }

        this.scoreLabel.string = `得分 ${score}`;
    }

    // 显示好感度信息（通关时显示 +N 的增幅）
    private showAffinity(config: LevelConfig, won: boolean) {
        if (!this.affinityLabel) return;

        // 没有关联角色时的提示
        if (config.charId === undefined) {
            this.affinityLabel.node.active = true;
            this.affinityLabel.string = "本关无剧情关联";
            return;
        }

        const name = CHAR_NAMES[config.charId] ?? `角色${config.charId}`;
        const current = this.gameManager.getAffinity(config.charId);
        this.affinityLabel.node.active = true;

        if (won) {
            const gain = this.gameManager.getAffinityGainForChar(config.charId);
            this.affinityLabel.string = `${name}  好感度 ${current}/100  (+${gain})`;
        } else {
            this.affinityLabel.string = `${name}  好感度 ${current}/100`;
        }
    }

    hide() {
        this.node.active = false;
    }

    // 星级规则：剩 1/3 以上 = 3 星；剩 1/5 以上 = 2 星；通关 = 1 星
    private calcStars(stepsLeft: number, maxSteps: number): number {
        const ratio = stepsLeft / maxSteps;
        if (ratio >= 1 / 3) return 3;
        if (ratio >= 1 / 5) return 2;
        return 1;
    }

    private onClickNext() {
        this.hide();
        this.gameManager.goToNextLevel();
    }

    private onClickRetry() {
        this.hide();
        this.gameManager.retryCurrentLevel();
    }
}