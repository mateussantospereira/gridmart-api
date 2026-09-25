import React, { useState } from "react";
import { api } from "../services/api";
import { formatCPF, cleanCPF, isValidCPF } from "../utils/formatters";
import { DoorIcon, ShieldLockIcon, CheckIcon, AlertIcon } from "./Icons";

type Mode = "entry" | "exit";

export const AccessControl: React.FC = () => {
  const [mode, setMode] = useState<Mode>("entry");
  const [cpfInput, setCpfInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "danger" | "warning";
    text: string;
    details?: string;
  } | null>(null);
  const [needsRegister, setNeedsRegister] = useState(false);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatCPF(raw);
    setCpfInput(formatted);
  };

  const handleCheckEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawDigits = cleanCPF(cpfInput);

    if (rawDigits.length !== 11) {
      setStatusMessage({
        type: "danger",
        text: "Número de CPF incompleto. Digite os 11 dígitos.",
      });
      return;
    }

    if (!isValidCPF(rawDigits)) {
      setStatusMessage({
        type: "danger",
        text: "Dígito verificador do CPF inválido. Verifique o número informado.",
      });
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(null);
      setNeedsRegister(false);

      const res = await api.checkAccess(rawDigits);

      if (res.allowed) {
        setStatusMessage({
          type: "success",
          text: "Acesso autorizado · Catraca destravada",
          details: `Cliente identificado: ${res.name || "Usuário"}. Pulso de abertura enviado.`,
        });
        setCpfInput("");
      } else if (res.registered && !res.allowed) {
        setStatusMessage({
          type: "danger",
          text: "Acesso bloqueado pela administração",
          details: res.error || "O cadastro está com restrição de entrada.",
        });
      } else if (!res.registered) {
        setStatusMessage({
          type: "warning",
          text: "Cadastro não localizado",
          details: "Para liberar a trava eletrônica pela primeira vez, conclua o cadastro rápido abaixo.",
        });
        setNeedsRegister(true);
      }
    } catch (err: any) {
      setStatusMessage({
        type: "danger",
        text: "Falha de comunicação com o servidor de acesso",
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawDigits = cleanCPF(cpfInput);

    if (!nameInput.trim() || nameInput.trim().length < 2) {
      setStatusMessage({
        type: "danger",
        text: "Informe o nome completo do titular (mínimo de 2 caracteres).",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await api.registerUser(rawDigits, nameInput.trim());

      setStatusMessage({
        type: "success",
        text: "Cadastro finalizado · Entrada liberada",
        details: `Bem-vindo(a), ${res.name}. Trava eletrônica acionada.`,
      });
      setNeedsRegister(false);
      setNameInput("");
      setCpfInput("");
    } catch (err: any) {
      setStatusMessage({
        type: "danger",
        text: "Não foi possível concluir o registro",
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawDigits = cleanCPF(cpfInput);

    if (rawDigits.length > 0 && (!isValidCPF(rawDigits) || rawDigits.length !== 11)) {
      setStatusMessage({
        type: "danger",
        text: "CPF inválido. Deixe o campo em branco ou digite um número regular.",
      });
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(null);

      const res = await api.exitAccess(rawDigits.length === 11 ? rawDigits : undefined);

      if (res.allowed) {
        setStatusMessage({
          type: "success",
          text: "Saída autorizada · Trava liberada",
          details: "Comando enviado para o controlador eletrônico.",
        });
        setCpfInput("");
      }
    } catch (err: any) {
      setStatusMessage({
        type: "danger",
        text: "Erro ao registrar liberação de saída",
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setStatusMessage(null);
    setNeedsRegister(false);
    setCpfInput("");
    setNameInput("");
  };

  return (
    <div className="gate-terminal">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <DoorIcon size={18} />
              Controle de Portaria & Catraca
            </h2>
            <p className="panel-desc">
              Interface do terminal de acesso integrado ao controlador ESP32 da porta.
            </p>
          </div>
          <span className="badge badge-subtle">
            {mode === "entry" ? "Sensor de Entrada" : "Sensor de Saída"}
          </span>
        </div>

        {/* Chave seletora de Entrada / Saída */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button
            type="button"
            className={`btn ${mode === "entry" ? "btn-secondary" : "btn-outline"}`}
            style={{ fontWeight: mode === "entry" ? 700 : 500 }}
            onClick={() => switchMode("entry")}
          >
            Terminal de Entrada
          </button>
          <button
            type="button"
            className={`btn ${mode === "exit" ? "btn-secondary" : "btn-outline"}`}
            style={{ fontWeight: mode === "exit" ? 700 : 500 }}
            onClick={() => switchMode("exit")}
          >
            Terminal de Saída
          </button>
        </div>

        {/* Banner de Feedback de Catraca */}
        {statusMessage && (
          <div className={`alert alert-${statusMessage.type}`}>
            {statusMessage.type === "success" && <CheckIcon size={18} />}
            {statusMessage.type === "danger" && <AlertIcon size={18} />}
            {statusMessage.type === "warning" && <ShieldLockIcon size={18} />}
            <div>
              <div style={{ fontWeight: 600 }}>{statusMessage.text}</div>
              {statusMessage.details && (
                <div style={{ fontSize: "0.8rem", opacity: 0.9, marginTop: "0.15rem" }}>
                  {statusMessage.details}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Formulário de Validação de Entrada */}
        {mode === "entry" && !needsRegister && (
          <form onSubmit={handleCheckEntry}>
            <div className="form-group">
              <label className="form-label">Identificação por CPF</label>
              <input
                type="text"
                className="input"
                placeholder="000.000.000-00"
                value={cpfInput}
                onChange={handleCpfChange}
                maxLength={14}
                autoFocus
                style={{ fontSize: "1.1rem", fontFamily: "var(--font-mono)", textAlign: "center" }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              disabled={loading || cleanCPF(cpfInput).length !== 11}
            >
              {loading ? "Validando no banco..." : "Validar e Destravar Entrada"}
            </button>
          </form>
        )}

        {/* Formulário de Cadastro Rápido */}
        {mode === "entry" && needsRegister && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">CPF Informado</label>
              <input
                type="text"
                className="input"
                value={cpfInput}
                disabled
                style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <input
                type="text"
                className="input"
                placeholder="Nome e Sobrenome..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setNeedsRegister(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={loading || nameInput.trim().length < 2}
              >
                {loading ? "Registrando..." : "Confirmar e Abrir Porta"}
              </button>
            </div>
          </form>
        )}

        {/* Formulário de Saída */}
        {mode === "exit" && (
          <form onSubmit={handleExit}>
            <div className="form-group">
              <label className="form-label">Auditoria de Saída (Opcional)</label>
              <input
                type="text"
                className="input"
                placeholder="Deixe em branco ou digite CPF..."
                value={cpfInput}
                onChange={handleCpfChange}
                maxLength={14}
                style={{ fontFamily: "var(--font-mono)" }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? "Enviando comando..." : "Liberar Trava Eletrônica"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
