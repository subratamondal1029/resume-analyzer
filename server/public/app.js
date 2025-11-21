const form = document.getElementById("upload-form");
const fileInput = document.getElementById("fileInput");
const submitBtn = document.getElementById("submitBtn");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");
const resultDiv = document.getElementById("result");

let currentSource = null;

function setProgress(pct, status) {
  progressBar.style.width = pct + "%";
  progressBar.setAttribute("aria-valuenow", pct);
  statusText.textContent = status + ` (${pct}%)`;
}

function showResult(result) {
  const rows = Array.isArray(result) ? result : [result];

  // Clear previous results
  resultDiv.innerHTML = "";

  // Create table
  const table = document.createElement("table");
  table.className = "result-table";

  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>Status</th><th>Rule</th><th>Evidence</th><th>Reasoning</th><th>Confidence</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");

    const tdStatus = document.createElement("td");
    tdStatus.textContent = r.status ?? "";

    const tdRule = document.createElement("td");
    tdRule.textContent = r.rule ?? "";

    const tdEvidence = document.createElement("td");
    tdEvidence.textContent = r.evidence ?? "";

    const tdReasoning = document.createElement("td");
    tdReasoning.textContent = r.reasoning ?? "";

    const tdConfidence = document.createElement("td");
    tdConfidence.textContent = r.confidence != null ? `${r.confidence}%` : "";

    tr.append(tdStatus, tdRule, tdEvidence, tdReasoning, tdConfidence);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  resultDiv.appendChild(table);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!fileInput.files.length) {
    alert("Please choose a PDF file first.");
    return;
  }

  submitBtn.disabled = true;
  statusText.textContent = "Uploading...";

  const data = new FormData();
  data.append("file", fileInput.files[0]);

  try {
    const resp = await fetch("/api/pdf-analyze", {
      method: "POST",
      body: data,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.message || "Upload failed");
    }

    const json = await resp.json();
    const { analysisId, fileName } = json?.data || {};
    resultDiv.textContent = `Started analysis for: ${fileName}`;
    setProgress(0, "Starting analysis...");

    if (!analysisId) {
      throw new Error("No analysisId returned from server");
    }

    // Close any previous SSE
    if (currentSource) {
      currentSource.close();
    }

    currentSource = new EventSource(`/api/pdf-analyze/status/${analysisId}`);

    currentSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { progress, status } = data;
        setProgress(progress, status);
        if (progress >= 100) {
          const { data: resultData } = data;
          showResult(resultData);
          currentSource.close();
          submitBtn.disabled = false;
        }
      } catch (err) {
        console.error("Parse error:", err);
      }
    };

    currentSource.onerror = (err) => {
      console.error("SSE error", err);
      statusText.textContent = "Connection error.";
      currentSource.close();
      submitBtn.disabled = false;
    };
  } catch (err) {
    console.error(err);
    alert(err.message);
    statusText.textContent = "Failed.";
    submitBtn.disabled = false;
  }
});
