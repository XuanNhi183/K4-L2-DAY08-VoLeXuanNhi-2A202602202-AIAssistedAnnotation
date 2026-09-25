# Báo cáo Lab Ngày 08: Học chủ động cho bộ phát hiện xe

Họ và tên: Võ Lê Xuân Nhi

Công cụ gán nhãn đã dùng: CVAT

## 1. Dữ liệu và cách chia tập

Tại sao tập chưa gán nhãn (pool) và tập kiểm thử (test set) được chia theo trục thời gian, có vùng
đệm ở giữa, thay vì chia ngẫu nhiên? Nếu chia ngẫu nhiên, số đo trên tập kiểm thử sẽ bị lệch theo
hướng nào, và vì sao?

- Các ảnh được trích từ cùng một video có camera cố định, nên những khung hình gần nhau thường có cùng nền và cùng những chiếc xe, chỉ khác một chút về vị trí. Ảnh trong pool sau khi được chọn và gán nhãn sẽ dùng để huấn luyện. Vì vậy, chia pool và test theo thời gian giúp giảm khả năng mô hình được kiểm tra trên cảnh gần như đã thấy khi học. Vùng đệm loại các ảnh nằm sát các đoạn kiểm thử, hạn chế việc cùng một chiếc xe xuất hiện ở cả hai tập. Cách chia này giảm trùng lặp nhưng không làm hai tập hoàn toàn độc lập, vì chúng vẫn thuộc cùng một camera và điều kiện quay.

- Nếu chia ngẫu nhiên từng ảnh, các khung hình liên tiếp có thể rơi vào cả tập huấn luyện và tập kiểm thử. Khi đó xảy ra rò rỉ dữ liệu: mô hình được đánh giá trên những hình ảnh rất giống dữ liệu đã học. Các số đo như AP50, precision và recall có thể cao hơn mức phản ánh khả năng nhận diện trên cảnh mới, khiến kết quả có vẻ tốt hơn thực tế. Chia theo thời gian kèm vùng đệm giúp đánh giá khả năng khái quát đáng tin cậy hơn so với cách chia ngẫu nhiên trong trường hợp này.

## 2. Mô hình khởi đầu lạnh (cold start)

Chép dòng vòng 0 từ `rounds_table.md`. Dựa vào `outputs/compare_round0.jpg`, cho biết mô hình khởi
đầu lạnh không khớp nhãn tham chiếu ở những loại xe nào. Độ phủ (recall) theo kích thước xe cho
thấy điều gì? Một trường hợp nào cần người rà lại nhãn tham chiếu trước khi kết luận mô hình sai?

Dòng vòng 0 trong [rounds_table.md](rounds_table.md):

| vòng | model | ảnh train | box train | AP50 | Δ AP50 so cold start | P@0.25 | R@0.25 | F1 | R small | R medium | R large |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | yolov8n cold start (COCO car+bus+truck) | 0 | 0 | 0.771 | — | 0.925 | 0.489 | 0.640 | 0.182 | 0.547 | 0.561 |

Mô hình khởi đầu lạnh có AP50 là 0.771. Recall của xe có khung nhỏ là 0.182, xe có khung vừa là 0.547 và xe có khung lớn là 0.561, tương đương khoảng 18.2%, 54.7% và 56.1%. Xe ở xa thường có khung nhỏ, nên kết quả cho thấy nhóm xe này bị bỏ sót nhiều hơn nhóm xe ở gần. Các giá trị recall được tính tại ngưỡng confidence 0.25 và IoU 0.5.

Trong [ảnh so sánh vòng 0](../outputs/compare_round0.jpg), ở frame_0050.jpg, vùng xe có đèn hậu đỏ phía xa gần khúc cua có một khung AI màu đỏ lệch sang trái so với khung tham chiếu màu vàng gần đó. Đây là một chỗ cần phóng to và rà lại để xác định khung nào ôm đúng chiếc xe.

Nhãn dùng để chấm cũng do máy vẽ và chưa có người xem từng khung, nên có thể nhãn chấm sai chứ không phải mô hình sai. Vì vậy, cần kiểm tra cả nhãn tham chiếu trước khi kết luận về trường hợp không khớp này.

## 3. Chiến lược chọn mẫu

Giải thích bằng lời công thức `score = W_U·U + W_A·A + W_D·D` và vai trò của `MIN_GAP_S`.
Dẫn ba frame trong `reports/SELECTION.md` và một frame khác để chứng minh cách bạn cân nhắc
độ bất định, ảnh gần trùng và công gán nhãn. Điểm bất định có chứng minh ảnh đó sẽ cải thiện
mô hình không? Vì sao?

Điểm mỗi ảnh gồm 50% mức AI không chắc (`U`), 30% số khung còn lưỡng lự đã chuẩn hóa (`A`) và 20% khoảng cách thời gian tới ảnh đã gán nhãn gần nhất (`D`). `MIN_GAP_S = 2` giúp tránh chọn ảnh cách nhau dưới 2 giây vì camera đứng yên, cảnh gần trùng gây tốn công sửa lặp. Theo `SELECTION.md`, frame_0182.jpg (0.9591), frame_0099.jpg (0.9063) và frame_0107.jpg (0.8876) được chọn vì điểm cao và nhiều khung cần rà. frame_0372.jpg (0.9101) bị bỏ qua vì chỉ cách frame_0369.jpg 1.2 giây. Hiệu quả còn phụ thuộc chất lượng nhãn và huấn luyện, nên điểm cao không có nghĩa sửa ảnh đó sẽ làm AI giỏi hơn.

## 4. Các vòng học chủ động (active learning)

Chép bảng từ `rounds_table.md`. Với mỗi vòng, trình bày:

- mức độ bạn đã sửa nhãn gợi ý (số box giữ nguyên, chỉnh sửa, xoá, thêm mới, lấy từ
  `outputs/round*_diff.md`);
- AP50 thay đổi bao nhiêu so với khởi đầu lạnh và so với vòng trước;
- nhóm xe nào tốt lên hoặc xấu đi theo số đo trên cùng tập test.

Dựa vào các ảnh `compare_round*.jpg`, chỉ ra một ca kết quả đổi sau fine-tune (tốt hơn hoặc xấu
đi), cùng lý do có thể kiểm. Dùng `BLIND_SCAN.md`, `REVIEW_LOG.csv` và `round1_diff.md` phân biệt
quan sát độc lập, lỗi pre-label đã sửa và kết quả mô hình sau train. Mô tả một ca khó theo guideline.

- Bảng từ [rounds_table.md](rounds_table.md), đánh giá trên cùng tập test:

| vòng | model | ảnh train | box train | AP50 | Δ AP50 so cold start | P@0.25 | R@0.25 | F1 | R small | R medium | R large |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | yolov8n cold start (COCO car+bus+truck) | 0 | 0 | 0.771 | — | 0.925 | 0.489 | 0.640 | 0.182 | 0.547 | 0.561 |
| 1 | yolov8n fine-tune vong 1..1 | 12 | 276 | 0.602 | -0.170 | 1.000 | 0.102 | 0.185 | 0.000 | 0.078 | 0.439 |

Vòng 0 là mốc trước khi fine-tune. Ở vòng 1, theo [round1_diff.md](../outputs/round1_diff.md), tôi giữ gần nguyên 139 box, chỉnh 16, xóa 14 và thêm 121; từ 169 box gợi ý thành 276 box trên 12 ảnh. AP50 giảm khoảng 0.170 so với cả cold start và vòng trước, vì vòng trước chính là vòng 0. Recall đều giảm: xe nhỏ từ 0.182 xuống 0.000, xe vừa từ 0.547 xuống 0.078 và xe lớn từ 0.561 xuống 0.439; không nhóm nào tốt lên theo chỉ số này.

Trong [compare_round1.jpg](../outputs/compare_round1.jpg), xe bị cắt ở mép dưới frame_0050.jpg có khung xanh ở cold start nhưng chuyển thành khung vàng sau fine-tune, tức không còn khớp tham chiếu. Một khả năng là confidence giảm dưới ngưỡng 0.25; có thể kiểm tra bằng cách xem dự đoán trước khi lọc ngưỡng, chưa thể kết luận nguyên nhân chỉ từ ảnh.

[BLIND_SCAN.md](BLIND_SCAN.md) ghi quan sát bằng mắt là 20 xe ở frame_0099.jpg; đây là quan sát độc lập, không phải kết quả mô hình. [REVIEW_LOG.csv](REVIEW_LOG.csv) ghi việc sửa nhãn, như thêm khung cho xe bị cắt ở mép dưới bên phải frame_0182.jpg; guideline yêu cầu chỉ khoanh phần xe còn nhìn thấy trong ảnh. Báo cáo diff thống kê những thay đổi nhãn train này, còn bảng AP50 và ảnh so sánh đánh giá mô hình sau train trên test. Sửa nhiều nhãn không tự đảm bảo mô hình tốt hơn.

## 5. Kết luận và giới hạn

Kết quả vòng này so với cold start ra sao? Vì sao bạn dừng hoặc tiếp tục? Đề xuất hai ca còn yếu
hoặc bất định cho vòng sau, kèm chi phí rà nhãn và nguy cơ ảnh gần trùng. Tập kiểm thử chỉ 20 ảnh,
có luật bỏ qua xe quá nhỏ và nhãn tham chiếu do mô hình tạo chưa được rà thủ công; các giới hạn đó
ảnh hưởng thế nào đến kết luận? Nếu AP50 giảm, bạn sẽ kiểm tra điều gì trước khi train thêm?

- AP50 vòng 1 là 0.602, thấp hơn cold start 0.771, giảm khoảng 0.170; recall cũng giảm. Tôi chọn tạm dừng để kiểm tra lại các khung đã sửa, xe bị bỏ sót, việc ghép đúng ảnh với nhãn và cấu hình huấn luyện trước khi train thêm, thay vì mặc định thêm dữ liệu sẽ làm kết quả tốt hơn.

- Nếu làm vòng sau, sẽ ưu tiên rà xe xa chỉ còn cụm đèn ở frame_0074.jpg và xe bị cắt mép dưới ở frame_0008.jpg. Bằng chứng hình ảnh: [contact sheet lô vòng 2](../day8_round1_out/outputs/selection_round2.jpg). Xe xa cần phóng to để phân biệt thân xe với ánh sáng; xe bị cắt mép chỉ khoanh phần còn nhìn thấy. Cả hai đều tốn thời gian kiểm tra thủ công. Tránh chọn thêm ảnh sát thời điểm của chúng, giữ khoảng cách ít nhất 2 giây để giảm công sửa cảnh gần trùng.

- Tập test chỉ có 20 ảnh, bỏ qua box cao dưới 16 pixel và dùng nhãn do máy tạo chưa được người kiểm từng khung. Vì vậy, số đo còn hạn chế, không phản ánh đầy đủ khả năng tìm xe rất nhỏ và có thể bị ảnh hưởng bởi nhãn chấm sai; chưa thể khái quát kết quả sang camera hoặc cảnh khác.
