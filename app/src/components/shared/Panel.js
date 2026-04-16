"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Panel = void 0;
const Panel = ({ children, className = "", }) => (<section className={`app-shell-frame p-5 text-slate-100 ${className}`}>
    {children}
  </section>);
exports.Panel = Panel;
