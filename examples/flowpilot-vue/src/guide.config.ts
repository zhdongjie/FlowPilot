// examples/flowpilot-vue/src/guide.config.ts
import type { GuideStep } from "flowpilot";

export const onboardingSteps: GuideStep[] = [
    {
        id: "step_login",
        // 🌟 严格对应 data-fp="login_btn"
        when: "login_btn",
        next: ["step_dashboard"],
        ui: {
            selector: "#login-btn",
            content: "第一步：请输入任意内容并点击登录",
            position: "bottom"
        }
    },
    {
        id: "step_dashboard",
        // 🌟 严格对应 data-fp="open_account_btn"
        when: "open_account_btn",
        next: ["step_open_account"],
        ui: {
            // 🌟 选择器也必须一致
            selector: "[data-fp='open_account_btn']",
            content: "登录成功！现在点击这里开始开户",
            position: "right"
        }
    },
    {
        id: "step_open_account",
        // 🌟 严格对应 data-fp="submit_btn"
        when: "submit_btn",
        next: ["step_finish"],
        ui: {
            selector: "#submit-btn",
            content: "快！5秒内点击提交，否则引导消失！",
            position: "top"
        },
        cancelWhen: "!submit_btn within(5000)"
    },
    {
        id: "step_finish",
        when: "never", // 最后一步不需要结束条件
        ui: {
            selector: "h3",
            content: "恭喜！你已通关全部流程！",
            position: "bottom"
        }
    }
];
