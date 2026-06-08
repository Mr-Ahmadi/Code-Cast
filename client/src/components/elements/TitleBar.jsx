import { FiMinimize2, FiMaximize2, FiX, FiMinus, FiSquare } from "react-icons/fi";
import { useMode } from "../../contexts/ModeContext";

export default function TitleBar() {
    const isElectron = !!window.electronAPI?.isElectron;
    const platform = window.electronAPI?.platform;
    const isMac = platform === 'darwin';

    if (!isElectron) return null;

    const handleMinimize = () => window.electronAPI.window.minimize();
    const handleMaximize = () => window.electronAPI.window.maximize();
    const handleClose = () => window.electronAPI.window.close();

    return (
        <div className="custom-title-bar">
            <div className="title-bar-drag-region">
                <div className="title-bar-left">
                    {/* Placeholder for icon if needed */}
                </div>
                <div className="title-bar-center">
                    <span className="title-bar-text">CodeCast</span>
                </div>
                {!isMac && (
                    <div className="title-bar-right">
                        <button className="title-bar-btn" onClick={handleMinimize} title="Minimize">
                            <FiMinus size={14} />
                        </button>
                        <button className="title-bar-btn" onClick={handleMaximize} title="Maximize">
                            <FiSquare size={12} />
                        </button>
                        <button className="title-bar-btn close" onClick={handleClose} title="Close">
                            <FiX size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
