import assert from "node:assert/strict";
import { test } from "node:test";

await import("../extensao/detectores.js");
const motor = globalThis.PainelDetectores;
assert.ok(motor, "o motor compartilhado deve expor globalThis.PainelDetectores");

test("CPF válido é classificado como alto", () => {
  const resultado = motor.analisarTexto("CPF: 529.982.247-25");
  assert.equal(resultado.nivel, "alto");
  assert.ok(resultado.deteccoes.some((item) => item.tipo === "CPF"));
});

test("CPF inválido não é aceito pelo dígito verificador", () => {
  const resultado = motor.analisarTexto("CPF: 111.111.111-11");
  assert.equal(resultado.deteccoes.some((item) => item.tipo === "CPF"), false);
});

test("senha escrita e falada caem na mesma regra", () => {
  for (const texto of ["Senha:123", "minha senha é 123", "My password is Hunter2!"]) {
    const resultado = motor.analisarTexto(texto);
    assert.equal(resultado.nivel, "alto", texto);
    assert.ok(
      resultado.deteccoes.some((item) => item.tipo === "Senha ou credencial"),
      texto,
    );
  }
});

test("token de API conhecido é detectado", () => {
  const resultado = motor.analisarTexto("chave sk-proj-8fJ2kLm9Qr4Tz7Xb1Nc6Vd3");
  assert.equal(resultado.nivel, "alto");
  assert.ok(resultado.deteccoes.some((item) => item.tipo === "Token ou chave de API"));
});

test("texto sem dados monitorados continua baixo", () => {
  const resultado = motor.analisarTexto("Pode revisar a redação deste e-mail?");
  assert.equal(resultado.nivel, "baixo");
  assert.equal(resultado.deteccoes.length, 0);
});

test("regra editável de palavra-chave é aplicada", () => {
  const regra = {
    nome: "Projeto secreto",
    area: "Projetos",
    tipo: "palavra-chave",
    padrao: "atlas, órbita",
    risco: "medio",
    ativo: true,
  };
  const resultado = motor.analisarTexto("O cronograma do projeto Atlas foi alterado.", [regra]);
  assert.ok(resultado.deteccoes.some((item) => item.tipo === "Projeto secreto"));
  assert.equal(resultado.nivel, "medio");
});

test("conteúdo de texto e anexo é somado", () => {
  const base = motor.analisarTexto("CPF: 529.982.247-25");
  const anexo = {
    deteccoes: [{ tipo: "Token ou chave de API", area: "TI", risco: "alto", ocorrencias: 1 }],
  };
  const resultado = motor.analisarConteudo("CPF: 529.982.247-25", [anexo], null, []);
  assert.equal(resultado.deteccoes.length, 2);
  assert.equal(resultado.nivel, "alto");
  assert.equal(resultado.totalOcorrencias, base.totalOcorrencias + 1);
});
