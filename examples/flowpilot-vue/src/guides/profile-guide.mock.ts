import type { GuideDefinition } from "flowpilot";

export const profileCompletionGuideDefinition: GuideDefinition = {
    id: "guide.profile-completion",
    rootStepId: "step_login",
    steps: [
        {
            id: "step_login",
            when: "focus_login_btn && login_success",
            next: ["step_profile_entry"],
            ui: {
                selector: "#login-btn",
                content: "先登录系统，再开始资料完善流程。",
                position: "bottom"
            }
        },
        {
            id: "step_profile_entry",
            when: "click_profile_center_btn",
            next: ["step_profile_overview"],
            ui: {
                selector: "[data-fp='profile_center_btn']",
                content: "进入资料中心，补充联系信息。",
                position: "left"
            }
        },
        {
            id: "step_profile_overview",
            when: "click_next_step_profile_overview",
            next: ["step_field_mobile"],
            ui: {
                selector: "#profile-form",
                content: "这里是资料完善面板，我们先从手机号开始填写。",
                nextLabel: "开始完善",
                position: "top"
            }
        },
        {
            id: "step_field_mobile",
            when: "blur_profile_mobile",
            next: ["step_field_email"],
            ui: {
                selector: "[data-fp='profile_mobile']",
                content: "填写手机号，方便接收审核进度和业务通知。",
                position: "right"
            }
        },
        {
            id: "step_field_email",
            when: "blur_profile_email",
            next: ["step_save_profile"],
            ui: {
                selector: "[data-fp='profile_email']",
                content: "再补充常用邮箱，作为备用联系渠道。",
                position: "right"
            }
        },
        {
            id: "step_save_profile",
            when: "click_save_profile_btn",
            next: ["step_finish"],
            cancelWhen: "!click_save_profile_btn within(10000)",
            ui: {
                selector: "#save-profile-btn",
                content: "确认资料无误后，点击保存。",
                position: "bottom"
            }
        },
        {
            id: "step_finish",
            enterWhen: "profile_save_success",
            when: "timer(3000)",
            ui: {
                selector: "[data-fp='profile_success_card']",
                content: "资料已经保存成功，后续通知会优先发送到你刚补充的联系方式。",
                position: "top"
            }
        }
    ]
};
