import { memo, useRef, useEffect } from "react";
import PropTypes from 'prop-types';

const Output = memo(({ value }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current && value) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [value]);

    const isError = value?.startsWith("Error");
    const isEmpty = !value || value === "Run your code to see output";

    return (
        <div className="output-container" ref={containerRef} style={{ backgroundColor: 'var(--bg-primary)' }}>
            <div className="output-content-area">
                <div className={isEmpty ? "output-empty" : isError ? "output-error" : "output-content"}>
                    {isEmpty ? "Run your code to see output..." : (value || "")}
                </div>
            </div>
        </div>
    )
});

Output.displayName = 'Output';

Output.propTypes = {
    value: PropTypes.string,
}

export default Output
