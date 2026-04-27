import { createApp } from "vue";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";

import App from "./App.vue";
import { createDemoGuideService, demoGuideServiceKey } from "./guide-demo";
import { profileCompletionGuideDefinition } from "./guides/profile-guide.mock";

const mock = new MockAdapter(axios, { delayResponse: 800 });

mock.onPost("/api/login").reply(200, { code: "login_success" });
mock.onPost("/api/submit").reply(200, { code: "submit_success" });
mock.onPost("/api/profile/save").reply(200, { code: "profile_save_success" });
mock.onGet("/api/guides/profile-completion").reply(200, profileCompletionGuideDefinition);

const app = createApp(App);
const guideDemo = createDemoGuideService();

app.provide(demoGuideServiceKey, guideDemo);
app.mount("#app");
