// StoryManager.ts
// 剧情管理器：加载剧情、控制播放
// 挂到一个独立的 StoryManager 节点上

import { _decorator, Component, Node, resources, JsonAsset } from "cc";
import { StoryScript } from "./StoryData";
import { StoryPanel } from "./StoryPanel";
import { DialogBubble } from "./DialogBubble";

const { ccclass, property } = _decorator;

@ccclass("StoryManager")
export class StoryManager extends Component {

    @property(StoryPanel)
    storyPanel: StoryPanel = null!;

    @property(DialogBubble)
    dialogBubble: DialogBubble = null!;

    // 所有剧情脚本（按 ID 索引）
    private scripts: Map<number, StoryScript> = new Map();

    // 剧情结束时的回调（供 GameManager 接收好感度变化）
    onStoryComplete: ((storyId: number, affinityDelta: number) => void) | null = null;

    onLoad() {
        this.loadAllStories();
    }

    private loadAllStories() {
        resources.load("stories/index", JsonAsset, (err, asset) => {
            if (err) {
                console.warn("[StoryManager] 剧情索引加载失败", err);
                return;
            }
            const index = asset.json as { id: number; path: string }[];
            console.log(`[StoryManager] 发现 ${index.length} 个剧情`);

            index.forEach(entry => {
                resources.load(entry.path, JsonAsset, (err2, scriptAsset) => {
                    if (err2) {
                        console.warn(`[StoryManager] 加载剧情 ${entry.id} 失败`, err2);
                        return;
                    }
                    const script = scriptAsset.json as StoryScript;
                    this.scripts.set(script.id, script);
                    console.log(`[StoryManager] 已加载剧情 ${script.id}: ${script.name}`);
                });
            });
        });
    }

    // 外部调用：播放指定剧情
    playStory(storyId: number): boolean {
        const script = this.scripts.get(storyId);
        if (!script) {
            console.warn(`[StoryManager] 剧情 ${storyId} 未找到`);
            return false;
        }

        console.log(`[StoryManager] 播放剧情 ${storyId}: ${script.name}`);

        if (script.defaultMode === "fullscreen") {
            this.storyPanel?.play(script, (affinityDelta) => {
                this.onStoryComplete?.(storyId, affinityDelta);
            });
        } else {
            this.dialogBubble?.play(script, (affinityDelta) => {
                this.onStoryComplete?.(storyId, affinityDelta);
            });
        }
        return true;
    }

    hasStory(storyId: number): boolean {
        return this.scripts.has(storyId);
    }
}
