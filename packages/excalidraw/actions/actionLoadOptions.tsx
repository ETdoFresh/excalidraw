import { register } from "./register";
import { t } from "../i18n";
import { CaptureUpdateAction } from "@excalidraw/element";
import { LoadIcon } from "../components/icons";

export const actionOpenLoadOptions = register({
  name: "openLoadOptions",
  label: "buttons.load",
  icon: LoadIcon,
  trackEvent: { category: "export", action: "openLoadOptions" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.loadScene && 
      !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, _, app) => {
    return {
      appState: {
        ...appState,
        openDialog: { name: "loadOptions" },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});