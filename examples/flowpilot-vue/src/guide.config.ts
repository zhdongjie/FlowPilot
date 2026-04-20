// examples/flowpilot-vue/src/guide.config.ts
import type { GuideStep } from "flowpilot";

export const onboardingSteps: GuideStep[] = [
    {
        id: "step_login",
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
        enterWhen: "login_success",
        when: "open_account_btn",
        next: ["step_open_account"],
        ui: {
            selector: "[data-fp='open_account_btn']",
            content: "登录成功！系统自动拦截了接口返回。现在请点击开户",
            position: "right"
        }
    },
    {
        id: "step_open_account",
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
        enterWhen: "submit_success",
        when: "never",
        ui: {
            selector: "h2",
            content: "恭喜！你已通关全部流程！",
            position: "bottom"
        }
    }
];
