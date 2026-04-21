// examples/flowpilot-vue/src/guide.config.ts
import type { GuideStep } from "flowpilot";

export const onboardingSteps: GuideStep[] = [
    {
        id: "step_login",
        when: "focus_login_btn && login_success",
        next: ["step_dashboard"],
        ui: {
            selector: "#login-btn",
            content: "第一步：请输入账号密码并点击登录",
            position: "bottom"
        }
    },
    {
        id: "step_dashboard",
        when: "click_open_account_btn",
        next: ["step_form_overview"], // 进化：不再直接进入输入框，先预览整体
        ui: {
            selector: "[data-fp='open_account_btn']",
            content: "登录成功！现在请点击“我要开户”开始申请",
            position: "right"
        }
    },
    // 新增：表单容器预览（建立全局认知）
    {
        id: "step_form_overview",
        // 信号进化：支持手动点击气泡内的“开始”按钮跳转
        when: "click_next_step_form_overview",
        next: ["step_field_name"],
        ui: {
            selector: "#account-form", // 高亮整个表单外框
            content: "这是您的开户申请表，请依次完成基本信息填写",
            nextLabel: "开始填写", // 自动渲染“我知道了”按钮
            position: "top"
        }
    },
    // 进化：拆分多字段引导
    {
        id: "step_field_name",
        when: "blur_user_name", // 只有用户填完并离开该字段时，才跳下一步
        next: ["step_field_id"],
        ui: {
            selector: "[data-fp='user_name']",
            content: "请输入您的真实姓名",
            position: "right"
        }
    },
    {
        id: "step_field_id",
        when: "blur_id_card",
        next: ["step_submit_form"],
        ui: {
            selector: "[data-fp='id_card']",
            content: "请输入18位身份证号以完成核验",
            position: "right"
        }
    },
    {
        id: "step_submit_form",
        when: "click_submit_btn",
        next: ["step_finish"],
        ui: {
            selector: "#submit-btn",
            content: "检查无误后，点击此处提交申请",
            position: "bottom"
        },
        cancelWhen: "!click_submit_btn within(10000)" // 延长到10秒，给用户检查时间
    },
    {
        id: "step_finish",
        enterWhen: "submit_success",
        when: "timer(3000)", // 增加至3秒，给用户阅读庆功文案的时间
        ui: {
            selector: "h2",
            content: "🎉 恭喜！开户资料已成功提交，请耐心等待审核。",
            position: "bottom"
        }
    }
];
