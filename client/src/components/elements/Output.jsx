import { memo, useRef, useEffect, useCallback } from "react";
import { FiTerminal, FiCopy, FiTrash2 } from "react-icons/fi";
import PropTypes from 'prop-types';

const Output = memo(({ value, onClear }) => {
    const containerRef = useRef(null);
    const hasContent = value && value !== "Run your code to see output" && !value.startsWith("Error");

    useEffect(() => {
        if (containerRef.current && value) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [value]);

    const handleCopy = useCallback(() => {
        if (value) {
            navigator.clipboard.writeText(value).catch(() => {});
        }
    }, [value]);

    const isError = value?.startsWith("Error");
    const isEmpty = !value || value === "Run your code to see output";

    return (
        <div className="output-container" ref={containerRef}>
            <div className="output-header">
                <FiTerminal size={14} />
                Output
                <div className="output-header-actions">
                    {hasContent && (
                        <button className="output-action-btn" onClick={handleCopy} title="Copy output" aria-label="Copy output">
                            <FiCopy size={12} />
                        </button>
                    )}
                    {value && (
                        <button className="output-action-btn" onClick={onClear} title="Clear output" aria-label="Clear output">
                            <FiTrash2 size={12} />
                        </button>
                    )}
                </div>
            </div>
            <div className={isEmpty ? "output-empty" : isError ? "output-error" : "output-content"}>
                {value || "Run your code to see output"}
            </div>
        </div>
    )
});

Output.displayName = 'Output';

Output.propTypes = {
    value: PropTypes.string,
    onClear: PropTypes.func,
}

export default Output