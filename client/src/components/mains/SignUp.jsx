import { Link } from "react-router-dom";
import useForm from "../../hooks/useForm";
import signUp from "../../functions/requests/signUp";
import { FiInfo } from "react-icons/fi";

const SignUp = () => {
    const {
        values, message,
        handleChange,
        handleSubmit,
        handleReset,
    } = useForm({
        email: "",
        password: "",
        repeatPassword: "",
    }, signUp);

    const msgType = message[0] === "ERROR" ? "error" : message[0] === "SUCCESS" ? "success" : message[0] === "LOADING" ? "loading" : null;

    return (
        <div className="partial-container">
            <h2 className="partial-title">Sign Up</h2>
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
                        autoComplete="new-password"
                        required
                        aria-required="true"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                        <FiInfo size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                        8+ characters, upper + lower + number
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="repeatPassword">Repeat Password</label>
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
                <div className="bottom-row">
                    <div>
                        <Link to="/signin">Already have an account?</Link>
                    </div>
                    <div>
                        <input className="btn btn-sm"
                            type="reset" value="Clear"
                            disabled={message[0] === "LOADING"}
                        />
                        <input className={"btn btn-primary btn-sm" + (message[0] === "LOADING" ? " btn-loading" : "")}
                            type="submit" value="Sign Up"
                            disabled={message[0] === "LOADING"}
                        />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default SignUp;
