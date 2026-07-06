-- Permite criar categorias reais do tipo "transferencia" (antes a transação de
-- transferência usava a string fixa 'Transferência', sem categoria de verdade).

-- 1. categories.type precisa aceitar 'transferencia'
alter table categories drop constraint if exists categories_type_check;
alter table categories add constraint categories_type_check
  check (type in ('receita', 'despesa', 'transferencia', 'ambos'));

-- 2. Garantia: transactions.type também precisa aceitar 'transferencia'.
-- O schema.sql original só previa ('receita', 'despesa') — se essa constraint
-- nunca foi alterada manualmente no banco, salvar uma transação de transferência
-- falha. Recriar aqui garante que aceita os três valores.
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('receita', 'despesa', 'transferencia'));

-- 3. Dado órfão: transações antigas de transferência foram salvas com a
-- categoria fixa "Transferência" (texto solto, sem categoria real por trás,
-- de quando o campo de categoria ficava escondido nesse tipo). Move pra
-- "Outros", que agora vale pros três tipos (receita/despesa/transferência).
update transactions
set category = 'Outros'
where type = 'transferencia' and category = 'Transferência';
