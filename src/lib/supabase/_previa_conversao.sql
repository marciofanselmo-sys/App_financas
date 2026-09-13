-- ============================================================================
-- PRÉVIA — não altera nada. Mostra o que a conversão vai fazer.
-- ============================================================================
select
  case
    when description ~* 'pgto\s+fat'                                then 'PGTO FAT -> despesa INTERNA'
    when description ~* '^\s*envio\s+de\s+ted\s+transf'             then 'TED corretora -> despesa INTERNA'
    when description ~* 'pagamento\s+(de\s+)?fatura'                then 'Fatura paga -> receita INTERNA'
    when description ~* 'pagamento\s+on\s*line'                     then 'Fatura paga -> receita INTERNA'
    when description ~* 'marcio\s+fagundes\s+anselmo'
         and description ~* 'recebid'                               then 'Voce mesmo -> receita INTERNA'
    when description ~* 'marcio\s+fagundes\s+anselmo'
         and description ~* 'enviad'                                then 'Voce mesmo -> despesa INTERNA'
    when description ~* 'mercadopago'                               then 'Compra cartao -> despesa normal'
    when description ~* 'enviad[ao]'                                then 'Pix p/ terceiro -> despesa normal'
    when description ~* 'recebid[ao]'                               then 'Pix de terceiro -> receita normal'
    else                                                                 'NAO CONVERTIDO (fica como esta)'
  end                                  as o_que_vai_acontecer,
  count(*)                             as linhas,
  round(sum(amount)::numeric, 2)       as total_reais
from transactions
where type = 'transferencia'
group by 1
order by 2 desc;
