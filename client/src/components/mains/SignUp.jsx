import { Link } from "react-router-dom";
import useForm from "../../hooks/useForm";
import signUp from "../../functions/requests/signUp";
import AuthShell from "../elements/AuthShell";
import { FiInfo } from "react-icons/fi";

const SignUp = () => {
    const {
        values, message,
        handleChange,
        handleSubmit,
    } = useForm({
        email: "",
        password: "",
        repeatPassword: "",
    }, signUp);

    const msgType = message[0] === "ERROR" ? "error" : message[0] === "SUCCESS" ? "success" : message[0] === "LOADING" ? "loading" : null;
    const loading = message[0] === "LOADING";

    return (
        <AuthShell
            title="Create an account"
            subtitle="Store your projects and recordings on your Code Cast server."
            footer={
                <p className="auth-alt">
                    Already have an account? <Link to="/signin">Sign in</Link>
                </p>
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
                        autoComplete="new-password"
                        required
                        aria-required="true"
                        aria-describedby="password-hint"
                    />
                    <small id="password-hint" className="form-hint">
                        <FiInfo size={11} />
                        8+ characters, with upper case, lower case and a number
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="repeatPassword">Repeat password</label>
                    <input
                        className="text-input full-width"
                        type="password"
                        name="repeatPassword"
                        id="repeatPassword"
                        value={values.repeatPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
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
                    Create account
                </button>
            </form>
        </AuthShell>
    );
};

export default SignUp;
