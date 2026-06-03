import { memo, useRef, useEffect, useCallback } from "react";
import { FiCopy, FiTrash2 } from "react-icons/fi";
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
            <div className="output-content-area">
                <div className={isEmpty ? "output-empty" : isError ? "output-error" : "output-content"}>
                    {value || "Run your code to see output"}
                </div>
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
