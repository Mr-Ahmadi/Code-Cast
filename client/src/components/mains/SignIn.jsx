import useForm from "../../hooks/useForm";
import { Link, useNavigate } from "react-router-dom";
import signIn from "../../functions/requests/signIn";
import { useMode, MODES } from "../../contexts/ModeContext";

const SignIn = () => {
    const {
        values, message,
        handleChange,
        handleSubmit,
        handleReset,
    } = useForm({
        email: "",
        password: "",
    }, signIn);

    const msgType = message[0] === "ERROR" ? "error" : message[0] === "SUCCESS" ? "success" : message[0] === "LOADING" ? "loading" : null;
    const { setMode } = useMode();
    const navigate = useNavigate();

    const handleOffline = () => {
        setMode(MODES.LOCAL);
        navigate('/');
    };

    return (
        <div className="partial-container">
            <h2 className="partial-title">Sign In</h2>
            <form onSubmit={handleSubmit} onReset={handleReset}>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        className="text-input full-width"
                        name="email"
                        id="email"
                        value={values.email}
                        onChange={handleChange}
                        autoComplete="email"
                        required
                        aria-required="true"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        className="text-input full-width"
                        type="password"
                        name="password"
                        id="password"
                        value={values.password}
                        onChange={handleChange}
                        autoComplete="current-password"
                        required
                        aria-required="true"
                    />
                </div>
                {msgType && (
                    <span className={"message-output " + msgType} role="status">
                        {message[1]}
                    </span>
                )}
                <div className="bottom-row">
                    <div>
                        <Link to="/signup">Create account</Link>
                    </div>
                    <div>
                        <input className="btn btn-sm"
                            type="reset" value="Clear"
                            disabled={message[0] === "LOADING"}
                        />
                        <input className={"btn btn-primary btn-sm" + (message[0] === "LOADING" ? " btn-loading" : "")}
                            type="submit" value="Sign In"
                            disabled={message[0] === "LOADING"}
                        />
                    </div>
                </div>
            </form>
            <div className="offline-divider">
                <span>or</span>
            </div>
            <button className="btn btn-primary btn-full" onClick={handleOffline}>
                Continue Offline
            </button>
        </div>
    );
};

export default SignIn;
