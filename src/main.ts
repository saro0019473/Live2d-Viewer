import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./style.css";
import "./styles/app-styles.css";

// Create Pinia store
const pinia = createPinia();

// Create application instance
const app = createApp(App);

// Mount store
app.use(pinia);

// Mount application
app.mount("#app");
