// WxMock.ts
// 编辑器预览时模拟微信 API，打包成真实小游戏时不需要这个文件

if (typeof wx === "undefined") {
    (globalThis as any).wx = {
        setStorageSync: (key: string, val: any) => {
            localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val));
        },
        getStorageSync: (key: string) => {
            return localStorage.getItem(key) ?? "";
        },
        createRewardedVideoAd: () => ({
            onClose: () => {},
            show: () => Promise.resolve(),
        }),
    };
}