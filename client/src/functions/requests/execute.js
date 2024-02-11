import axios from "axios";

const Piston_API = axios.create({
  baseURL: "https://emkc.org/api/v2/piston",
});

export const executeCode = async (language, sourceCode) => {
  const response = await Piston_API.post("/execute", {
    language: language[0],
    version: language[1],
    files: [
      {
        content: sourceCode,
      },
    ],
  });
  console.log(response);
  return response.data;
};
