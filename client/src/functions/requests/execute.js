import axios from "axios";

export const executeCode = async (language, sourceCode) => {
  const response = await axios.request({
    method: "post",
    url: "index/execute",
    headers: { "Content-Type": "application/json" },
    data: {
      language: language[0],
      version: language[1],
      sourceCode,
    },
    withCredentials: true,
  });
  return response.data;
};
