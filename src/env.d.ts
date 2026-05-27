/// <reference types="vite/client" />

declare interface Window {
  __live2dReady: boolean;
  PIXI: any;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
