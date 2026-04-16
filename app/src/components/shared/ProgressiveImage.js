"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressiveImage = void 0;
const image_1 = __importDefault(require("next/image"));
const react_1 = require("react");
const ProgressiveImage = ({ alt, className, wrapperClassName = "", ...props }) => {
    const [isLoaded, setIsLoaded] = (0, react_1.useState)(false);
    const fillWrapperClassName = props.fill ? "h-full w-full" : "";
    return (<div className={`relative overflow-hidden ${fillWrapperClassName} ${wrapperClassName}`}>
      <div aria-hidden className={`absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),rgba(255,255,255,0.05)_22%,transparent_70%),linear-gradient(180deg,rgba(18,24,37,0.96)_0%,rgba(9,14,22,0.92)_100%)] transition duration-500 ${isLoaded ? "opacity-0" : "opacity-100"}`}/>
      <image_1.default {...props} alt={alt} className={`${className ?? ""} transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isLoaded ? "scale-100 blur-0" : "scale-[1.035] blur-2xl"}`} onLoadingComplete={() => setIsLoaded(true)}/>
    </div>);
};
exports.ProgressiveImage = ProgressiveImage;
