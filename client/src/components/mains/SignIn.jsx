import useForm from "../../hooks/useForm";
import { Link, useNavigate } from "react-router-dom";
import signIn from "../../functions/requests/signIn";
import { useMode, MODES } from "../../contexts/ModeContext";
import AuthShell from "../elements/AuthShell";
import { FiMonitor } from "react-icons/fi";

const SignIn = () => {
    const {
        values, message,
        handleChange,
        handleSubmit,
    } = useForm({
        email: "",
        password: "",
    }, signIn);

    const msgType = message[0] === "ERROR" ? "error" : message[0] === "SUCCESS" ? "success" : message[0] === "LOADING" ? "loading" : null;
    const { setMode } = useMode();
    const navigate = useNavigate();
    const loading = message[0] === "LOADING";

    const handleOffline = () => {
        setMode(MODES.LOCAL);
        navigate('/');
    };

    return (
        <AuthShell
            title="Welcome back"
            subtitle="Sign in to reach your projects and recordings."
            footer={
                <>
                    <div className="offline-divider"><span>or</span></div>
                    <button className="btn btn-full auth-offline-btn" onClick={handleOffline}>
                        <FiMonitor size={14} />
                        Continue offline
                    </button>
                    <p className="auth-alt">
                        New here? <Link to="/signup">Create an account</Link>
                    </p>
                </>
            }
        >
            <form onSubmit={handleSubmit}>
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
                        autoFocus
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
                <button
                    className={"btn btn-primary btn-full" + (loading ? " btn-loading" : "")}
                    type="submit"
                    disabled={loading}
                >
                    Sign in
                </button>
            </form>
        </AuthShell>
    );
};

export default SignIn;
