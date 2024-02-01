import useForm from "../../hooks/useForm";
import { Link } from "react-router-dom";
import signUp from "../../functions/requests/signUp";

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

    return (
        <div className="partial-container">
            <h2 className="partial-title">Sign Up</h2>
            <form onSubmit={handleSubmit} onReset={handleReset}>
                <div className="form-group">
                    <label htmlFor="email">
                        Email
                    </label>
                    <input
                        type="email"
                        className="text-input"
                        name="email"
                        value={values.email}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">
                        Password
                    </label>
                    <input className="text-input"
                        type="password"
                        name="password"
                        value={values.password}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="repeatPassword">
                        Repeat Password
                    </label>
                    <input className="text-input"
                        type="password"
                        name="repeatPassword"
                        value={values.repeatPassword}
                        onChange={handleChange}
                    />
                </div>
                {message[0] === "ERROR"
                    ? <span className="message-output">{message[1]}</span>
                    : message[0] === "SUCCESS"
                        ? <span className="message-output">{message[1]}</span>
                        : message[0] === "LOADING"
                            ? <span className="message-output">Loading...</span>
                            : <></>}
                <div className="bottom-row">
                    <div>
                        <Link to="/signin">Sign In</Link>
                    </div>
                    <div>
                        <input className="btn-primary"
                            type="reset" value="Clear"
                            disabled={message[0] === "LOADING"}
                        />
                        <input className="btn-primary"
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